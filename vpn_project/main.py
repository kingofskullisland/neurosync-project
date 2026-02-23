import threading
import sys
import time
from kivy.app import App
from kivy.uix.label import Label
from src.bridge import VpnController
from src.server import run_server

class VpnApp(App):
    def build(self):
        self.controller = VpnController()
        # Start Flask in a background thread
        self.server_thread = threading.Thread(target=run_server, args=(self.controller,))
        self.server_thread.daemon = True
        self.server_thread.start()
        return Label(text="VPN Backend Active\nControl via Web UI at 127.0.0.1:5000")

if __name__ == '__main__':
    VpnApp().run()
