#!/bin/bash

# Enable verbose mode (print executed commands)
set -x

LOCAL_CACHE_LAYER_URL=http://13.51.207.250:9000
PROVIDER_ID=redstone-rapid
SIGNED_DATA_PACKAGE='{"timestamp":1657388351114,"liteSignature":"0x3376366140e5059582c2460b71578d1efbc66b7717d44eb5371bbea6b66f571206cc6c328268dce812f3d726cf3168c8571f76d1c1bc0664f498ea1b6a62ac351c","provider":"zYqPZuALSPa_f5Agvf8g2JHv94cqMn9aBtnH7GFHbuA","prices":[{"symbol":"BTC","value":21838.105485},{"symbol":"ETH","value":1226.4842127142026},{"symbol":"BNB","value":243.611683225},{"symbol":"DOGE","value":0.06990503},{"symbol":"XRP","value":0.34552715},{"symbol":"ADA","value":0.481968895},{"symbol":"DOT","value":7.27636},{"symbol":"XLM","value":0.11404647500000001},{"symbol":"AR","value":11.93872765},{"symbol":"CELO","value":0.975512},{"symbol":"AVAX","value":20.163363275000002},{"symbol":"USDT","value":0.9995}]}'

# Saving a package
curl -vs -X POST $LOCAL_CACHE_LAYER_URL/packages -H "Content-Type: application/json" -d $SIGNED_DATA_PACKAGE

# Fetching packages
curl -vs -X GET $LOCAL_CACHE_LAYER_URL/packages/latest?provider=$PROVIDER_ID
