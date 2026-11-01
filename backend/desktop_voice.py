"""Standalone speech sidecar: no FastAPI, document engine, or fixed port required."""
import io
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

token = os.environ.get('KIWI_VOICE_TOKEN', '')
model = None
lock = threading.Lock()


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_POST(self):
        global model
        if not token or self.headers.get('Authorization') != f'Bearer {token}':
            self.send_error(401)
            return
        size = int(self.headers.get('Content-Length', '0'))
        if size < 1 or size > 5 * 1024 * 1024:
            self.send_error(413)
            return
        content = self.rfile.read(size)
        try:
            with lock:
                if model is None:
                    from faster_whisper import WhisperModel
                    # Use the cached model. No surprise model download on ordinary requests.
                    model = WhisperModel('small.en', device='cpu', compute_type='int8', cpu_threads=2,
                                         num_workers=1, local_files_only=True)
                segments, _ = model.transcribe(io.BytesIO(content), language='en', beam_size=1,
                                               vad_filter=True, condition_on_previous_text=False,
                                               initial_prompt='Hey Kiwi. Kiwi stop. Open GitHub. Open Spotify. Volume down.')
                text = ' '.join(s.text.strip() for s in segments).strip()
            body = json.dumps({'text': text}).encode()
            self.send_response(200)
        except Exception:
            body = json.dumps({'error': 'Speech model is not ready. Use Download speech model in settings, then try again.'}).encode()
            self.send_response(503)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    import sys
    if '--download' in sys.argv:
        from huggingface_hub import snapshot_download
        snapshot_download('Systran/faster-whisper-small.en', allow_patterns=['model.bin', 'config.json', 'tokenizer.json', 'vocabulary.*'])
        print('Speech model downloaded.', flush=True)
    else:
        server = HTTPServer(('127.0.0.1', 0), Handler)
        print(json.dumps({'port': server.server_port}), flush=True)
        server.serve_forever()
