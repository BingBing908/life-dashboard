# seedUuid（lib/db.ts）的 PowerShell 复刻：算 plan_items 确定性 id 用（云端注入前算 id）。
# 用法：把 key（plan_item:track|title|time_slot 每行一个）写进本目录 tmp-keys.txt 再跑本脚本。
# 已对拍验证（仙人揉腹 9e1e31c9-19c6-5c36-b3b7-384baa7bf9d0）。PS5.1 十六进制字面量是 int32 会溢出，所以用十进制。
$keys = [System.IO.File]::ReadAllLines("$PSScriptRoot\tmp-keys.txt", [System.Text.Encoding]::UTF8)
[uint64]$OFFSET = 2166136261
[uint64]$PRIME = 16777619
[uint64]$MASK32 = 4294967295
foreach ($key in $keys) {
  if (-not $key) { continue }
  $bytes = New-Object byte[] 16
  for ($r = 0; $r -lt 4; $r++) {
    $s = "${r}:$key"
    [uint64]$h = $OFFSET
    foreach ($ch in $s.ToCharArray()) {
      $h = $h -bxor ([uint64][int][char]$ch)
      $h = ($h * $PRIME) -band $MASK32
    }
    $bytes[$r*4]   = ($h -shr 24) -band 255
    $bytes[$r*4+1] = ($h -shr 16) -band 255
    $bytes[$r*4+2] = ($h -shr 8) -band 255
    $bytes[$r*4+3] = $h -band 255
  }
  $bytes[6] = ($bytes[6] -band 15) -bor 80
  $bytes[8] = ($bytes[8] -band 63) -bor 128
  $hex = -join ($bytes | ForEach-Object { $_.ToString("x2") })
  $uuid = "{0}-{1}-{2}-{3}-{4}" -f $hex.Substring(0,8), $hex.Substring(8,4), $hex.Substring(12,4), $hex.Substring(16,4), $hex.Substring(20,12)
  Write-Output $uuid
}
