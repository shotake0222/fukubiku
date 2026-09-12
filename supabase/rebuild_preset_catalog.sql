-- ============================================================
-- fukubiku テンプレート台帳の再構築（何度でも実行可・冪等）
--
-- これ1本で preset_objects を「リポジトリの public/presets/ に実在する
-- ファイル」と一致した状態に戻します。seed_presets.sql / seed_object_presets.sql
-- 〜v7.sql のどれを実行済みかを気にする必要はありません。
--
-- やること:
--   1. URLを相対パス(/presets/...)へ統一。公開ドメインを変えても二度と壊れない
--   2. 実体の無い旧GIFを、同名の透過MP4へ貼り替え
--   3. 同じURLで重複している行を1行にまとめ、既存の注文/抽選セットの参照を付け替え
--   4. 実在する473ファイルを全件登録（名前・カテゴリ・サムネ・serviceを正す）
--   5. 実体の無くなった行のうち、どこからも参照されていないものを削除
--   6. 結果を表示
--
-- 【実行方法】
--   Supabase ダッシュボード > SQL Editor に「全文をまとめて」貼り付けて実行。
--   1文ずつ分けて実行しないでください（途中で止まると台帳が半端な状態になります）。
--   begin/commit で囲ってあるので、途中で失敗しても何も変更されません。
--
-- 既存の注文・抽選セット・あてんど案件のデータは壊しません。
-- 管理画面からアップロードした独自オブジェクトにも触れません。
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 0) 正となる台帳を作る（public/presets/ の実ファイルから機械生成）
--    shape: six    = 1等〜6等＋参加賞
--           four   = 大当たり/当たり/クーポン/はずれ＋参加賞
--           eleven = 上記すべて＋またね（2026-09に追加した24種）
--    has_mp4  : 透過MP4版があるか
--    has_thumb: サムネイルPNGがあるか
-- ------------------------------------------------------------
drop table if exists preset_catalog_tmp;
create table preset_catalog_tmp (
  name text not null,
  category text not null,
  model_url text not null primary key,
  thumbnail_url text
);

insert into preset_catalog_tmp (name, category, model_url, thumbnail_url)
with cat(value, label, shape, has_mp4, has_thumb) as (values
  ('amida', 'あみだくじ', 'six', true, true),
  ('box', 'ボックス抽選', 'six', true, true),
  ('darts', 'ダーツ', 'four', true, true),
  ('garagara', 'ガラガラ抽選', 'four', true, true),
  ('omikuji', 'おみくじ', 'six', true, true),
  ('scratch', 'スクラッチ', 'four', true, true),
  ('roulette', 'ルーレット', 'four', false, true),
  ('dice', 'サイコロ', 'six', false, true),
  ('treasure', '宝箱', 'four', false, true),
  ('slot', 'スロット', 'six', false, true),
  ('gacha', 'ガチャガチャ', 'six', false, true),
  ('mallet', '打ち出の小槌', 'four', false, true),
  ('cat', '招き猫', 'four', false, true),
  ('daruma', 'だるま', 'six', false, true),
  ('lantern', 'ランタン', 'four', false, true),
  ('firework', '打ち上げ花火', 'four', false, true),
  ('airlottery', 'エアー抽選機', 'six', false, true),
  ('fan', '扇子', 'four', false, true),
  ('pachinko', 'パチンコ', 'six', false, true),
  ('jet', '戦闘機の的撃ち', 'four', false, true),
  ('rocket', 'ロケット発射', 'six', false, true),
  ('meteor', '隕石落下', 'four', false, true),
  ('shuriken', '手裏剣ヒット', 'six', false, true),
  ('dragon', '龍が玉を掴む', 'four', false, true),
  ('iaido', '居合斬り', 'six', false, true),
  ('ufo', 'UFOビーム', 'four', false, true),
  ('cannon', '大砲・クラッカー砲', 'six', false, true),
  ('thunder', '雷神の一撃', 'four', false, true),
  ('punch', '超パンチ', 'six', false, true),
  ('sankaku', '三角くじ', 'eleven', false, false),
  ('ema', '絵馬', 'eleven', false, false),
  ('kagamibiraki', '鏡開き', 'eleven', false, false),
  ('xmas', 'クリスマス', 'eleven', false, false),
  ('vending', '自動販売機', 'eleven', false, false),
  ('receipt', 'レシート', 'eleven', false, false),
  ('ring', '輪投げ', 'eleven', false, false),
  ('safe', '金庫', 'eleven', false, false),
  ('fukubukuro', '福袋', 'eleven', false, false),
  ('sakura', '桜', 'eleven', false, false),
  ('mamemaki', '豆まき', 'eleven', false, false),
  ('otoshidama', 'お年玉', 'eleven', false, false),
  ('crane', 'クレーンゲーム', 'eleven', false, false),
  ('mogura', 'もぐらたたき', 'eleven', false, false),
  ('bowling', 'ボウリング', 'eleven', false, false),
  ('makimono', '巻物', 'eleven', false, false),
  ('shateki', '射的', 'eleven', false, false),
  ('kingyo', '金魚すくい', 'eleven', false, false),
  ('kakigori', 'かき氷', 'eleven', false, false),
  ('halloween', 'ハロウィン', 'eleven', false, false),
  ('valentine', 'バレンタイン', 'eleven', false, false),
  ('tanabata', '七夕', 'eleven', false, false),
  ('sushi', '回転寿司', 'eleven', false, false),
  ('taiyaki', 'たい焼き', 'eleven', false, false)
),
tier(key, ja, grp, ord) as (values
  ('1tou',    '1等',     'six',    1),
  ('2tou',    '2等',     'six',    2),
  ('3tou',    '3等',     'six',    3),
  ('4tou',    '4等',     'six',    4),
  ('5tou',    '5等',     'six',    5),
  ('6tou',    '6等',     'six',    6),
  ('ohatari', '大当たり', 'four',   7),
  ('atari',   '当たり',   'four',   8),
  ('coupon',  'クーポン', 'four',   9),
  ('hazure',  'はずれ',   'four',  10),
  ('cookie',  null,      'cookie', 11)
),
pair as (
  select c.*, t.key,
         -- クールダウン中に出すオブジェクトの呼び名は、追加時期で違う
         coalesce(t.ja, case when c.shape = 'eleven' then 'またね' else '参加賞' end) as tier_ja
  from cat c
  join tier t
    on t.grp = 'cookie'
    or c.shape = 'eleven'
    or c.shape = t.grp
)
select p.label || ' - ' || p.tier_ja || '（3Dオブジェクト）',
       p.value,
       '/presets/' || p.value || '/' || p.value || '_' || p.key || '_3d.glb',
       case when p.has_thumb
            then '/presets/' || p.value || '/' || p.value || '_' || p.key || '_3d_thumb.png' end
from pair p
union all
select p.label || ' - ' || p.tier_ja,
       p.value,
       '/presets/' || p.value || '/' || p.value || '_' || p.key || '.mp4',
       null
from pair p
where p.has_mp4;

-- ------------------------------------------------------------
-- 1) 既存行のURLを相対パスへ統一する
--    (初期シードは https://fukubikiu.attend-ar.com/... 、その後
--     https://app.fukubikiu.com/... と2度ドメインが変わっている。
--     アプリ側は同一オリジンで配信しているので相対パスが一番安全)
--    重複が一時的に発生しうるので、先に一意インデックスを外す。
-- ------------------------------------------------------------
drop index if exists preset_objects_model_url_idx;

update preset_objects
   set model_url = regexp_replace(model_url, '^https?://[^/]+(/presets/)', '\1')
 where model_url ~ '^https?://[^/]+/presets/';

update preset_objects
   set thumbnail_url = regexp_replace(thumbnail_url, '^https?://[^/]+(/presets/)', '\1')
 where thumbnail_url ~ '^https?://[^/]+/presets/';

-- ------------------------------------------------------------
-- 2) 実体の無い旧GIFを、同名の透過MP4へ貼り替える
--    (GIFはモバイルで再生できない端末が多く、public/presets/ からも
--     すでに削除済み。台帳にMP4がある場合だけ貼り替える)
-- ------------------------------------------------------------
update preset_objects p
   set model_url = regexp_replace(p.model_url, '\.gif$', '.mp4'),
       thumbnail_url = null
 where p.model_url like '/presets/%'
   and p.model_url like '%.gif'
   and exists (
     select 1 from preset_catalog_tmp c
      where c.model_url = regexp_replace(p.model_url, '\.gif$', '.mp4')
   );

-- ------------------------------------------------------------
-- 3) 同じURLの行が複数あれば1行にまとめる。
--    既存の注文・抽選セット・あてんど案件が参照している場合は、
--    参照先を残す1行へ付け替えてから消す（データは失われない）。
-- ------------------------------------------------------------
do $$
declare
  refs text[][] := array[
    array['orders',                 'preset_object_id'],
    array['draw_group_entries',     'preset_object_id'],
    array['attend_trigger_objects', 'preset_object_id'],
    array['attend_rallies',         'reward_preset_object_id'],
    array['attend_rally_spots',     'preset_object_id']
  ];
  dup record;
  keeper uuid;
  i int;
begin
  for dup in
    select model_url from preset_objects group by model_url having count(*) > 1
  loop
    select id into keeper
      from preset_objects
     where model_url = dup.model_url
     order by created_at asc, id asc
     limit 1;

    for i in 1 .. array_length(refs, 1) loop
      if to_regclass('public.' || refs[i][1]) is not null then
        execute format(
          'update %I set %I = $1 where %I in (select id from preset_objects where model_url = $2 and id <> $1)',
          refs[i][1], refs[i][2], refs[i][2]
        ) using keeper, dup.model_url;
      end if;
    end loop;

    delete from preset_objects where model_url = dup.model_url and id <> keeper;
  end loop;
end $$;

create unique index preset_objects_model_url_idx on preset_objects (model_url);

-- ------------------------------------------------------------
-- 4) 台帳を流し込む。既にある行は名前・カテゴリ・サムネ・serviceを正す。
--    (idは変えないので、既存の注文や抽選セットの紐付けはそのまま残る)
-- ------------------------------------------------------------
insert into preset_objects (name, category, model_url, thumbnail_url, service)
select c.name, c.category, c.model_url, c.thumbnail_url, 'fukubiku'
  from preset_catalog_tmp c
on conflict (model_url) do update
   set name          = excluded.name,
       category      = excluded.category,
       thumbnail_url = excluded.thumbnail_url,
       service       = 'fukubiku';

-- ------------------------------------------------------------
-- 5) service が未設定の行を埋める
--    (初期スキーマには service 列が無く、NULLのままだと管理画面に出てこない)
-- ------------------------------------------------------------
update preset_objects set service = 'attend'
 where service is null and model_url like '/presets/attend/%';
update preset_objects set service = 'fukubiku'
 where service is null;

-- ------------------------------------------------------------
-- 6) 実体の無くなった /presets/ 配下の行を掃除する。
--    どこからも参照されていないものだけ。あてんど用(/presets/attend/)と
--    管理画面からアップロードした独自オブジェクトには手を付けない。
-- ------------------------------------------------------------
do $$
declare
  refs text[][] := array[
    array['orders',                 'preset_object_id'],
    array['draw_group_entries',     'preset_object_id'],
    array['attend_trigger_objects', 'preset_object_id'],
    array['attend_rallies',         'reward_preset_object_id'],
    array['attend_rally_spots',     'preset_object_id']
  ];
  cond text := '';
  i int;
begin
  for i in 1 .. array_length(refs, 1) loop
    if to_regclass('public.' || refs[i][1]) is not null then
      cond := cond || format(' and not exists (select 1 from %I r where r.%I = p.id)',
                             refs[i][1], refs[i][2]);
    end if;
  end loop;

  execute '
    delete from preset_objects p
     where p.model_url like ''/presets/%''
       and p.model_url not like ''/presets/attend/%''
       and not exists (select 1 from preset_catalog_tmp c where c.model_url = p.model_url)
    ' || cond;
end $$;

drop table if exists preset_catalog_tmp;

commit;

-- ------------------------------------------------------------
-- 7) 結果の確認
-- ------------------------------------------------------------
-- 全体のサマリ。gif_remaining と absolute_url_remaining が0、
-- fukubiku_total が 473 になっていれば成功。
select
  count(*) filter (where service = 'fukubiku')                as fukubiku_total,
  count(*) filter (where service = 'fukubiku'
                     and model_url like '%.glb')              as glb,
  count(*) filter (where service = 'fukubiku'
                     and model_url like '%.mp4')              as mp4,
  count(*) filter (where model_url like '%.gif')              as gif_remaining,
  count(*) filter (where model_url ~ '^https?://')            as absolute_url_remaining,
  count(*) filter (where service is null)                     as service_null_remaining
from preset_objects;

-- カテゴリごとの内訳。53カテゴリすべてが並び、glbが5〜11件、
-- amida/box/omikuji/darts/garagara/scratch だけ mp4 も入っていれば正常。
select category,
       count(*)                                   as total,
       count(*) filter (where model_url like '%.glb') as glb,
       count(*) filter (where model_url like '%.mp4') as mp4
  from preset_objects
 where service = 'fukubiku'
 group by category
 order by category;
