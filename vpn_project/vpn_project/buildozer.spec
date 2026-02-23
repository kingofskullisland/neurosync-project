[app]
title = Python VPN
package.name = vpnflask
package.domain = org.test
source.dir = .
source.include_exts = py,png,jpg,kv,atlas,html,css,js,java

version = 0.1
requirements = python3,kivy,flask,pyjnius,android,requests

orientation = portrait
fullscreen = 0

# Android Permissions
android.permissions = INTERNET, ACCESS_NETWORK_STATE, BIND_VPN_SERVICE, FOREGROUND_SERVICE

# API Configuration
android.api = 33
android.minapi = 21
android.ndk = 25b

# Java Source Integration
android.add_src = src/java

# Service Manifest Injection
android.manifest.extra_xml = <service android:name="org.test.vpnflask.PythonVpnService" android:permission="android.permission.BIND_VPN_SERVICE"><intent-filter><action android:name="android.net.VpnService"/></intent-filter></service>

[buildozer]
log_level = 2
warn_on_root = 1
