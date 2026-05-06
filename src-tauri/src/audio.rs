use anyhow::{anyhow, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use parking_lot::Mutex;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::mpsc::{channel, Sender};
use std::sync::Arc;

const TARGET_SAMPLE_RATE: u32 = 16_000;

enum Cmd {
    Start(Sender<Result<()>>),
    Stop(Sender<()>),
}

pub struct Recorder {
    tx: Sender<Cmd>,
    samples: Arc<Mutex<Vec<f32>>>,
    config: Arc<Mutex<Option<(u32, u16)>>>,
    level: Arc<AtomicU32>,
}

impl Recorder {
    pub fn new() -> Self {
        let (tx, rx) = channel();
        let samples = Arc::new(Mutex::new(Vec::new()));
        let config = Arc::new(Mutex::new(None));
        let level = Arc::new(AtomicU32::new(0));
        let s = Arc::clone(&samples);
        let c = Arc::clone(&config);
        let l = Arc::clone(&level);
        std::thread::Builder::new()
            .name("local-whisper-audio".into())
            .spawn(move || audio_thread(rx, s, c, l))
            .expect("spawn audio thread");
        Self { tx, samples, config, level }
    }

    pub fn start(&self) -> Result<()> {
        self.samples.lock().clear();
        *self.config.lock() = None;
        self.level.store(0, Ordering::Relaxed);
        let (rtx, rrx) = channel();
        self.tx
            .send(Cmd::Start(rtx))
            .map_err(|_| anyhow!("audio thread gone"))?;
        rrx.recv().map_err(|_| anyhow!("audio thread closed"))?
    }

    pub fn stop(&self) -> Result<Vec<f32>> {
        let (rtx, rrx) = channel();
        self.tx
            .send(Cmd::Stop(rtx))
            .map_err(|_| anyhow!("audio thread gone"))?;
        let _ = rrx.recv();
        self.level.store(0, Ordering::Relaxed);
        let raw = std::mem::take(&mut *self.samples.lock());
        let (rate, channels) = self
            .config
            .lock()
            .ok_or_else(|| anyhow!("never started"))?;
        Ok(to_mono_16k(&raw, rate, channels))
    }

    pub fn level(&self) -> f32 {
        f32::from_bits(self.level.load(Ordering::Relaxed))
    }
}

fn audio_thread(
    rx: std::sync::mpsc::Receiver<Cmd>,
    samples: Arc<Mutex<Vec<f32>>>,
    config: Arc<Mutex<Option<(u32, u16)>>>,
    level: Arc<AtomicU32>,
) {
    let mut active: Option<cpal::Stream> = None;
    while let Ok(cmd) = rx.recv() {
        match cmd {
            Cmd::Start(reply) => {
                let res = build_stream(
                    Arc::clone(&samples),
                    Arc::clone(&config),
                    Arc::clone(&level),
                );
                match res {
                    Ok(stream) => match stream.play() {
                        Ok(()) => {
                            active = Some(stream);
                            let _ = reply.send(Ok(()));
                        }
                        Err(e) => {
                            let _ = reply.send(Err(anyhow!("stream play: {e}")));
                        }
                    },
                    Err(e) => {
                        let _ = reply.send(Err(e));
                    }
                }
            }
            Cmd::Stop(reply) => {
                active.take(); // drops & stops the stream
                let _ = reply.send(());
            }
        }
    }
}

fn update_level(level: &AtomicU32, peak: f32) {
    // Decay toward new peak so bars don't jitter to 0 between callbacks.
    let prev = f32::from_bits(level.load(Ordering::Relaxed));
    let scaled = (peak * 1.6).clamp(0.0, 1.0);
    let next = scaled.max(prev * 0.78);
    level.store(next.to_bits(), Ordering::Relaxed);
}

fn build_stream(
    samples: Arc<Mutex<Vec<f32>>>,
    config: Arc<Mutex<Option<(u32, u16)>>>,
    level: Arc<AtomicU32>,
) -> Result<cpal::Stream> {
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or_else(|| anyhow!("no default input device"))?;
    let supported = device.default_input_config()?;
    let sample_format = supported.sample_format();
    let stream_cfg: cpal::StreamConfig = supported.clone().into();
    *config.lock() = Some((stream_cfg.sample_rate.0, stream_cfg.channels));

    let err_fn = |e| log::error!("cpal stream error: {e}");
    let stream = match sample_format {
        cpal::SampleFormat::F32 => {
            let level = Arc::clone(&level);
            device.build_input_stream(
                &stream_cfg,
                move |data: &[f32], _: &_| {
                    let peak = data.iter().fold(0f32, |m, s| m.max(s.abs()));
                    update_level(&level, peak);
                    samples.lock().extend_from_slice(data);
                },
                err_fn,
                None,
            )?
        }
        cpal::SampleFormat::I16 => {
            let level = Arc::clone(&level);
            device.build_input_stream(
                &stream_cfg,
                move |data: &[i16], _: &_| {
                    let peak = data.iter().fold(0f32, |m, &s| {
                        m.max((s as f32 / i16::MAX as f32).abs())
                    });
                    update_level(&level, peak);
                    let mut buf = samples.lock();
                    buf.extend(data.iter().map(|&s| s as f32 / i16::MAX as f32));
                },
                err_fn,
                None,
            )?
        }
        cpal::SampleFormat::U16 => {
            let level = Arc::clone(&level);
            device.build_input_stream(
                &stream_cfg,
                move |data: &[u16], _: &_| {
                    let peak = data.iter().fold(0f32, |m, &s| {
                        m.max(((s as f32 - 32768.0) / 32768.0).abs())
                    });
                    update_level(&level, peak);
                    let mut buf = samples.lock();
                    buf.extend(data.iter().map(|&s| (s as f32 - 32768.0) / 32768.0));
                },
                err_fn,
                None,
            )?
        }
        other => return Err(anyhow!("unsupported sample format: {other:?}")),
    };
    Ok(stream)
}

fn to_mono_16k(samples: &[f32], rate: u32, channels: u16) -> Vec<f32> {
    if samples.is_empty() {
        return Vec::new();
    }
    let mono: Vec<f32> = if channels <= 1 {
        samples.to_vec()
    } else {
        let ch = channels as usize;
        samples
            .chunks_exact(ch)
            .map(|c| c.iter().sum::<f32>() / ch as f32)
            .collect()
    };
    if rate == TARGET_SAMPLE_RATE {
        return mono;
    }
    let ratio = TARGET_SAMPLE_RATE as f32 / rate as f32;
    let out_len = (mono.len() as f32 * ratio).floor() as usize;
    (0..out_len)
        .map(|i| {
            let src_pos = i as f32 / ratio;
            let idx = src_pos as usize;
            let frac = src_pos - idx as f32;
            let a = mono.get(idx).copied().unwrap_or(0.0);
            let b = mono.get(idx + 1).copied().unwrap_or(a);
            a + (b - a) * frac
        })
        .collect()
}
