@echo off
echo ================================================
echo  Ameya Dispatch Tracker v5
echo ================================================

REM Check keystore exists
if not exist "keystore.p12" (
    echo.
    echo  [!] keystore.p12 NOT FOUND.
    echo      Run this command once to create it:
    echo.
    echo      keytool -genkeypair -alias dispatch -keyalg RSA -keysize 2048 -storetype PKCS12 -keystore keystore.p12 -validity 3650 -storepass ameya@2024
    echo.
    echo      Then run build-and-run.bat again.
    echo ================================================
    pause
    exit /b 1
)

echo  [OK] keystore.p12 found
echo.
echo ================================================
echo  Building...
echo ================================================
call mvn clean package -DskipTests
if %ERRORLEVEL% NEQ 0 (
    echo BUILD FAILED! Check errors above.
    pause
    exit /b 1
)

echo.
echo ================================================
echo  Build SUCCESS! Starting application...
echo  Access at: https://192.168.151.7:8123
echo ================================================
java -jar target\invoice-tracker-1.0.0.jar
pause
