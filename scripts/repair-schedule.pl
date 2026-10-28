#!/usr/bin/perl
# 日程修复脚本（2026-10-28 建）
#
# ⚠️ 为什么存在：当天「新设备播种把 36 条模板推上云」的事故发生了**两次**，
#    每次都要靠证据重新推演一遍该删哪条、该改哪条。第二次之后决定固化成脚本。
#    代码侧的根因已修（守卫前置 + isSyncing + 播种前复查），这个脚本是**兜底**。
#
# 用法：  perl scripts/repair-schedule.pl        # 预演，只打印不写
#         perl scripts/repair-schedule.pl go     # 真写
#
# 幂等：每条先查当前值，已经是目标状态就跳过。重跑无副作用。
use strict; use warnings; use utf8; use JSON::PP;
binmode(STDOUT,":encoding(UTF-8)");
my $GO  = (($ARGV[0]//"") eq "go");
my $KEY = 'sb_publishable_lnEmC16u5sk2ylhzpBx1rg_l3VQQCb0';   # 公开值，见 src/lib/supabase.ts
my $URL = 'https://mqzvjrhfvjjuanjkwfsw.supabase.co/rest/v1/plan_items';
my $now = `date -u +%Y-%m-%dT%H:%M:%S.000Z`; chomp $now;

# ── 要软删的（按 标题+时段 定位；这些是种子模板里她早就删掉的东西）
my @KILL = (
  ["如厕","06:40–06:50"], ["空档","12:30–13:00"], ["空档","18:10–18:30"],
  ["缓冲","07:25–07:30"], ["缓冲","09:40–09:45"], ["睡觉","22:00–22:20"],
  ["工作","10:15–12:00"],                      # 她自己有 days=2,3,4,5 的那条，见下面 skip_mine
  ["通勤上班","09:45–10:15"],
  ["英语（新概念整块：复习→新课→朗读→单词）","07:50–09:40"],
  ["瑜伽/芭蕾把杆 40 分钟","19:50–20:30"],
  ["阅读（泡脚时段）","21:00–21:30"],
);
# ── 要改字段的：标题, 当前时段(定位用), {目标}
my @FIX = (
  ["日日学","13:00–14:00",{track=>"ai",       time_slot=>"13:00–13:55"}],
  ["AI 学习（晚间 75 分钟）","18:30–19:45",{days=>"2,4,5"}],
  ["仙人揉腹","06:10–06:30",{days=>"2,4,6",   time_slot=>"06:10–06:20"}],
  ["五脏逼毒","06:30–06:40",{days=>"1,3,5,7", time_slot=>"06:10–06:20"}],
  ["早餐","07:30–07:50",    {time_slot=>"09:20–09:40"}],
  ["八段锦（国体版）","06:50–07:05",{time_slot=>"06:50–07:00"}],
  ["AI 项目完善（周末大块·主线）","09:40–12:00",{time_slot=>"09:45–11:55"}],
  ["午餐","12:00–13:00",    {time_slot=>"12:00–12:55"}],   # 周末
  ["午餐","12:00–12:30",    {time_slot=>"12:05–12:30"}],   # 工作日
  ["AI 学习·周六下午大块（原华为认证时段）","13:00–18:00",{time_slot=>"13:00–17:55"}],
  ["打扫卫生","13:00–15:00",{time_slot=>"13:00–14:55"}],
  ["工作","14:00–17:30",    {time_slot=>"14:00–16:45"}],
  ["搓澡洗头沐浴","15:00–17:00",{time_slot=>"15:00–16:55"}],
  ["全身护肤护发","17:00–18:00",{time_slot=>"17:00–17:55"}],
  ["晚餐","17:30–17:50",    {time_slot=>"16:50–17:15"}],   # 工作日
  ["晚餐","18:00–18:40",    {time_slot=>"18:00–18:25"}],   # 周末
  ["冲澡","20:30–20:50",    {time_slot=>"20:35–20:55"}],
);

my $json = `curl -s "$URL?select=id,track,days,time_slot,title,deleted_at,created_at&limit=600" -H "apikey: $KEY" -H "Authorization: Bearer $KEY"`;
my $rows = decode_json($json);
my @live = grep { !$_->{deleted_at} } @$rows;
# ⚠️ 只动「事故行」：created_at 是事故那一秒的那批。她自己建的行一律不碰。
my $is_incident = sub { my $c=shift->{created_at}//""; $c =~ /^2026-10-28/ };

my ($done,$skip)=(0,0);
sub patch {
  my ($id,$body,$label)=@_;
  unless ($GO) { print "  [预演] $label\n"; $done++; return }
  open my $o,">","/tmp/_rep.json" or die; print $o JSON::PP->new->ascii(1)->encode({%$body, updated_at=>$now}); close $o;
  my $c=`curl -s -o /dev/null -w "%{http_code}" -X PATCH "$URL?id=eq.$id" -H "apikey: $KEY" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -H "Prefer: return=minimal" -d \@/tmp/_rep.json`;
  printf("  %s %s\n", ($c eq "204" ? "[已改]" : "[失败 $c]"), $label); $done++;
}
print "── 软删\n";
for my $k (@KILL) {
  my ($t,$s)=@$k;
  my @m = grep { $_->{title} eq $t && ($_->{time_slot}//"") eq $s && $is_incident->($_) } @live;
  unless (@m) { print "  （跳过，已不在）$t $s\n"; $skip++; next }
  if (@m>1) { print "  !! $t $s 匹配到 ".scalar(@m)." 条，人工确认\n"; next }
  patch($m[0]{id}, {deleted_at=>$now}, "$t $s");
}
print "── 改字段\n";
for my $x (@FIX) {
  my ($t,$s,$set)=@$x;
  my @m = grep { $_->{title} eq $t && ($_->{time_slot}//"") eq $s && $is_incident->($_) } @live;
  unless (@m) { print "  （跳过，已是目标值或不存在）$t $s\n"; $skip++; next }
  if (@m>1) { print "  !! $t $s 匹配到 ".scalar(@m)." 条，人工确认\n"; next }
  patch($m[0]{id}, $set, "$t $s → ".join(" ", map {"$_=$set->{$_}"} sort keys %$set));
}
printf("\n处理 %d 条，跳过 %d 条%s\n", $done, $skip, ($GO?"":"（预演，没有真写）"));
