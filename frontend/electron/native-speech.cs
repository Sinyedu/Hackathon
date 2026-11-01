using System;
using System.IO;
using System.Text;
using System.Linq;
using System.Threading;
using System.Speech.Recognition;

// Windows-only offline wake/hypothesis adapter. Audio stays in memory.
public static class KiwiSpeech {
  // Feed WAV fixtures at microphone speed so grammar updates happen between phrases.
  sealed class PacedStream : Stream {
    readonly FileStream source; readonly int bytesPerSecond;
    public PacedStream(string filename) {
      source = File.OpenRead(filename); var header = new byte[32]; source.Read(header, 0, header.Length); source.Position = 0;
      bytesPerSecond = Math.Max(8000, BitConverter.ToInt32(header, 28));
    }
    public override int Read(byte[] buffer, int offset, int count) { int read = source.Read(buffer, offset, count); if (read > 0) Thread.Sleep(Math.Max(1, read * 1000 / bytesPerSecond)); return read; }
    public override bool CanRead { get { return true; } } public override bool CanSeek { get { return true; } } public override bool CanWrite { get { return false; } }
    public override long Length { get { return source.Length; } } public override long Position { get { return source.Position; } set { source.Position = value; } }
    public override long Seek(long offset, SeekOrigin origin) { return source.Seek(offset, origin); }
    public override void Flush() { } public override void SetLength(long value) { throw new NotSupportedException(); } public override void Write(byte[] buffer, int offset, int count) { throw new NotSupportedException(); }
    protected override void Dispose(bool disposing) { if (disposing) source.Dispose(); base.Dispose(disposing); }
  }
  static SpeechRecognitionEngine engine;
  static Grammar wake, addressed, dictation, stop, known, knownAddressed;
  static readonly object outputLock = new object();
  static readonly ManualResetEvent finished = new ManualResetEvent(false);
  static bool awake = false, waking = false;
  static string mode = "armed";
  static DateTime expires, lastLevel;
  static void Emit(string kind, string text, string audio = "") {
    lock(outputLock) {
      Console.WriteLine(kind + "\t" + Convert.ToBase64String(Encoding.UTF8.GetBytes(text ?? "")) + (audio.Length > 0 ? "\t" + audio : ""));
      Console.Out.Flush();
    }
  }
  static bool HasWake(string text) {
    return text.StartsWith("hey kiwi", StringComparison.OrdinalIgnoreCase);
  }
  static bool ConfidentWake(RecognitionResult result) {
    return HasWake(result.Text) && result.Words.Count >= 2 && result.Words[0].Confidence >= .7 && result.Words[1].Confidence >= .7;
  }
  static void SetMode(string next) {
    mode = next;
    wake.Enabled = next == "armed" || next == "listening";
    addressed.Enabled = next == "armed" || next == "listening";
    knownAddressed.Enabled = addressed.Enabled;
    dictation.Enabled = next == "listening";
    known.Enabled = dictation.Enabled;
    stop.Enabled = next != "paused";
    if (next != "listening") { awake = false; waking = false; }
    else { awake = true; waking = false; expires = DateTime.UtcNow.AddSeconds(12); }
    Emit("status", next);
  }
  public static int Main(string[] args) {
    try {
      var recognizer = SpeechRecognitionEngine.InstalledRecognizers().FirstOrDefault(r => r.Culture.TwoLetterISOLanguageName == "en");
      if (recognizer == null) throw new Exception("No offline English speech recognizer is installed. Add English Speech in Windows language settings.");
      engine = new SpeechRecognitionEngine(recognizer);
      var start = new GrammarBuilder("hey kiwi"); start.Culture = recognizer.Culture;
      wake = new Grammar(start); wake.Name = "wake";
      var withCommand = new GrammarBuilder("hey kiwi"); withCommand.Culture = recognizer.Culture; withCommand.AppendDictation();
      addressed = new Grammar(withCommand); addressed.Name = "addressed";
      dictation = new DictationGrammar(); dictation.Name = "command"; dictation.Enabled = false;
      var stopBuilder = new GrammarBuilder(new Choices("kiwi stop", "hey kiwi stop")); stopBuilder.Culture = recognizer.Culture;
      stop = new Grammar(stopBuilder); stop.Name = "stop";
      var commands = new Choices("open github", "open youtube", "open google", "open spotify", "open discord", "open steam", "open calculator", "open notepad", "open files", "volume up", "volume down", "mute", "pause music", "next track", "what time is it", "what can you do", "switch to dark mode", "switch to light mode", "set a one minute timer", "set a five minute timer", "set a twenty five minute timer");
      var direct = new GrammarBuilder(commands); direct.Culture = recognizer.Culture;
      known = new Grammar(direct); known.Name = "command-fast"; known.Enabled = false; known.Priority = 10;
      var knownPrefix = new GrammarBuilder("hey kiwi"); knownPrefix.Culture = recognizer.Culture; knownPrefix.Append(commands);
      knownAddressed = new Grammar(knownPrefix); knownAddressed.Name = "addressed-fast"; knownAddressed.Priority = 10;
      engine.LoadGrammar(wake); engine.LoadGrammar(addressed); engine.LoadGrammar(dictation); engine.LoadGrammar(stop); engine.LoadGrammar(known); engine.LoadGrammar(knownAddressed);
      engine.EndSilenceTimeout = TimeSpan.FromMilliseconds(650);
      engine.EndSilenceTimeoutAmbiguous = TimeSpan.FromMilliseconds(900);
      engine.SpeechHypothesized += (s, e) => {
        if (mode == "paused" || mode == "busy") return;
        if (ConfidentWake(e.Result) || awake || waking) {
          if (!awake && !waking) { waking = true; expires = DateTime.UtcNow.AddSeconds(12); Emit("wake", ""); }
          Emit("partial", e.Result.Text);
        }
      };
      engine.AudioLevelUpdated += (s, e) => {
        if ((awake || waking) && (DateTime.UtcNow - lastLevel).TotalMilliseconds > 80) { lastLevel = DateTime.UtcNow; Emit("level", e.AudioLevel.ToString()); }
      };
      engine.RecognizerUpdateReached += (s, e) => SetMode((string)e.UserToken);
      engine.SpeechRecognized += (s, e) => {
        if (mode == "paused") return;
        if (e.Result.Grammar.Name == "stop" && e.Result.Confidence >= .55) { Emit("stop", ""); engine.RequestRecognizerUpdate("armed"); return; }
        if (mode == "busy") return;
        if (e.Result.Confidence < .45) { if (waking) { Emit("timeout", "I did not catch that. Say Hey Kiwi again."); engine.RequestRecognizerUpdate("armed"); } return; }
        if (e.Result.Grammar.Name == "wake") {
          awake = true; waking = false; expires = DateTime.UtcNow.AddSeconds(12);
          Emit("wake", ""); engine.RequestRecognizerUpdate("listening"); return;
        }
        if (e.Result.Grammar.Name.StartsWith("addressed") || (awake && e.Result.Grammar.Name.StartsWith("command"))) {
          if (!awake && !waking) Emit("wake", "");
          string audio = "";
          try { using (var stream = new MemoryStream()) { e.Result.Audio.WriteToWaveStream(stream); if (stream.Length < 5 * 1024 * 1024) audio = Convert.ToBase64String(stream.ToArray()); } } catch { }
          Emit("final", e.Result.Text, audio); engine.RequestRecognizerUpdate("busy");
        }
      };
      engine.SpeechRecognitionRejected += (s, e) => { if (awake || waking) Emit("partial", "Listening... please try again."); };
      engine.RecognizeCompleted += (s, e) => { if (e.Error != null) Emit("error", e.Error.Message); finished.Set(); };
      if (args.Length == 2 && args[0] == "--wav") engine.SetInputToWaveStream(new PacedStream(args[1]));
      else engine.SetInputToDefaultAudioDevice();
      engine.RecognizeAsync(RecognizeMode.Multiple);
      Emit("status", "armed");
      var input = new Thread(() => {
        string line;
        while ((line = Console.ReadLine()) != null) {
          if (line == "quit") { engine.RecognizeAsyncCancel(); finished.Set(); return; }
          if (line == "armed" || line == "busy" || line == "paused") engine.RequestRecognizerUpdate(line);
        }
      }); input.IsBackground = true; input.Start();
      while (!finished.WaitOne(200)) {
        if ((awake || waking) && mode != "busy" && mode != "paused" && DateTime.UtcNow > expires) { Emit("timeout", "Say Hey Kiwi when you are ready."); engine.RequestRecognizerUpdate("armed"); }
      }
      engine.Dispose(); return 0;
    } catch (Exception error) { Emit("error", error.Message); return 1; }
  }
}
