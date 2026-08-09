@echo off
cd /d E:\Repos\VBAI-phase2-recovered
echo ======================================================================
echo STEP 1: Running verify-v3-hardening.cjs
echo ======================================================================
node proxy\tests\verify-v3-hardening.cjs
if %ERRORLEVEL% NEQ 0 (
    echo STEP 1 FAILED
    exit /b 1
)
echo.
echo ======================================================================
echo STEP 2: Running existing unit tests
echo ======================================================================
node proxy\tests\legal-entity-extractor.test.cjs
if %ERRORLEVEL% NEQ 0 (
    echo legal-entity-extractor.test FAILED
    exit /b 1
)
node proxy\tests\answer-validator.test.cjs
if %ERRORLEVEL% NEQ 0 (
    echo answer-validator.test FAILED
    exit /b 1
)
node proxy\tests\legal-query-engine.test.cjs
if %ERRORLEVEL% NEQ 0 (
    echo legal-query-engine.test FAILED
    exit /b 1
)
echo.
echo ======================================================================
echo STEP 3: Golden legal extract tests
echo ======================================================================
cd /d E:\Repos\VBAI-phase2-recovered\proxy
node tests\golden-legal-extract.test.cjs
if %ERRORLEVEL% NEQ 0 (
    echo golden-legal-extract.test FAILED
    exit /b 1
)
echo.
echo ======================================================================
echo ALL PENDING TESTS PASSED
echo ======================================================================
