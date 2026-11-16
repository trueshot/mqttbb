@echo off
rem tt2.bat - the tt2bridge tab on Monkey (taghkanic gen-19, 2026-11-16). Restarts tt2bridge whenever it exits.
rem Datasets it serves: TT2BRIDGE_DATASETS (comma list). Console goes to tt2bridge-console.log so it can be read remotely.
cd /d %~dp0
set TT2BRIDGE_DATASETS=willdev
node tt2bridge.js >> tt2bridge-console.log 2>&1
timeout /t 5 /nobreak > nul
"%~dp0tt2.bat"
