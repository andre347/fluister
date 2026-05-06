use anyhow::{anyhow, Result};
use std::path::Path;
use whisper_rs::{
    FullParams, SamplingStrategy, WhisperContext, WhisperContextParameters,
};

pub struct Transcriber {
    ctx: WhisperContext,
}

impl Transcriber {
    pub fn new(model_path: &Path) -> Result<Self> {
        if !model_path.exists() {
            return Err(anyhow!(
                "whisper model not found at {}. Download a ggml model (e.g. ggml-base.en.bin) and place it there.",
                model_path.display()
            ));
        }
        let path_str = model_path
            .to_str()
            .ok_or_else(|| anyhow!("non-utf8 model path"))?;
        let ctx = WhisperContext::new_with_params(path_str, WhisperContextParameters::default())
            .map_err(|e| anyhow!("whisper load failed: {e}"))?;
        Ok(Self { ctx })
    }

    pub fn transcribe(
        &self,
        samples: &[f32],
        initial_prompt: &str,
        whisper_lang: Option<&str>,
    ) -> Result<String> {
        if samples.is_empty() {
            return Ok(String::new());
        }
        let mut state = self
            .ctx
            .create_state()
            .map_err(|e| anyhow!("whisper state: {e}"))?;

        let mut params = FullParams::new(SamplingStrategy::Greedy { best_of: 1 });
        params.set_n_threads(num_cpus().min(8) as i32);
        params.set_translate(false);
        // `None` here lets Whisper auto-detect; otherwise we pin to the ISO
        // code so no time is spent on detection and so it never accidentally
        // "translates" foreign-language audio into English.
        params.set_language(whisper_lang);
        params.set_print_special(false);
        params.set_print_progress(false);
        params.set_print_realtime(false);
        params.set_print_timestamps(false);
        params.set_suppress_blank(true);
        params.set_no_context(true);
        // Be stricter about silence — default 0.6 lets a lot of hallucinated
        // captions through on quiet recordings.
        params.set_no_speech_thold(0.65);
        // Custom vocabulary: nudges Whisper toward the user's jargon, names,
        // and acronyms. Empty string is a no-op.
        if !initial_prompt.is_empty() {
            params.set_initial_prompt(initial_prompt);
        }

        state
            .full(params, samples)
            .map_err(|e| anyhow!("whisper run: {e}"))?;

        let n = state
            .full_n_segments()
            .map_err(|e| anyhow!("segments count: {e}"))?;
        let mut out = String::new();
        for i in 0..n {
            let seg = state
                .full_get_segment_text(i)
                .map_err(|e| anyhow!("segment text: {e}"))?;
            out.push_str(&seg);
        }
        Ok(out.trim().to_string())
    }
}

fn num_cpus() -> usize {
    std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
}
