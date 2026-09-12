-- ============================================================
-- fukubiku テンプレート台帳の再構築（何度でも実行可・冪等）
--
-- これ1本で preset_objects を「アプリに実在するテンプレート473件」と
-- 一致した状態へ戻します。seed_presets.sql / seed_object_presets.sql 〜 v7.sql の
-- どれを実行済みかを気にする必要はありません。
--
-- 【設計方針】
-- 一時テーブルも PL/pgSQL の DO ブロックも使っていません。
-- すべての文が単独で完結し、前の文が作ったオブジェクトに依存しないため、
-- SQLエディタが文をどう分割して実行しても壊れません。
-- 途中で止まった場合は、もう一度先頭から実行すれば正しい状態になります。
--
-- 既存の注文・抽選セット・あてんど案件のデータは壊しません。
-- 管理画面からアップロードした独自オブジェクト（storageのURL）にも触れません。
--
-- 【実行方法】
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行。
-- エディタ上でテキストを選択していると「選択範囲だけ」が実行されるので、
-- どこも選択していない状態で Run を押してください。
-- ============================================================


-- ------------------------------------------------------------
-- 0) model_url の一意インデックスを一時的に外す
--
--    URLの正規化やGIF→MP4の貼り替えの途中で、同じURLの行が一時的に
--    重複しうるため。(3)の最後で作り直す。
-- ------------------------------------------------------------
drop index if exists preset_objects_model_url_idx;


-- ------------------------------------------------------------
-- 1) URLを相対パス(/presets/...)へ統一する
--
--    初期リリースは https://fukubikiu.attend-ar.com/... 、その後
--    https://app.fukubikiu.com/... と2度ドメインが変わっており、
--    古いドメインのままのレコードは404になって何も表示されない。
--    アプリは同一オリジンで配信しているので、相対パスにしておけば
--    今後ドメインを変えても二度と壊れない。
--    (コード側の焦らし用/クールダウン用オブジェクトのURLも元々相対パス)
-- ------------------------------------------------------------
update preset_objects
   set model_url = regexp_replace(model_url, '^https?://[^/]+(/presets/)', '\1')
 where model_url ~ '^https?://[^/]+/presets/';

update preset_objects
   set thumbnail_url = regexp_replace(thumbnail_url, '^https?://[^/]+(/presets/)', '\1')
 where thumbnail_url ~ '^https?://[^/]+/presets/';


-- ------------------------------------------------------------
-- 2) 実体の無い旧GIFを、同名の透過MP4へ貼り替える
--
--    初期シードはGIFで登録していたが、public/presets/ 配下のGIFは
--    すべて透過MP4に差し替え済み。MP4が用意してある6カテゴリだけを対象にする。
--    GIFを指したままのサムネイルは消す(空ならmodel_urlからプレビューが作られる)。
-- ------------------------------------------------------------
update preset_objects
   set model_url = regexp_replace(model_url, '\.gif$', '.mp4'),
       thumbnail_url = null
 where model_url like '%.gif'
   and model_url ~ '^/presets/(amida|box|darts|garagara|omikuji|scratch)/';


-- ------------------------------------------------------------
-- 3) 同じURLの行が複数ある場合、1行に集約する
--
--    まず、注文・抽選セット・あてんど案件からの参照を「そのURLで一番古い1行」
--    へ付け替える。付け替えてから重複行を消すので、既存データは失われない。
--    重複が無い場合は同じidを入れ直すだけで、実質何も起きない。
-- ------------------------------------------------------------
update orders o
   set preset_object_id = (
         select q.id from preset_objects q
          where q.model_url = (select p.model_url from preset_objects p where p.id = o.preset_object_id)
          order by q.created_at, q.id limit 1)
 where o.preset_object_id is not null;

update draw_group_entries e
   set preset_object_id = (
         select q.id from preset_objects q
          where q.model_url = (select p.model_url from preset_objects p where p.id = e.preset_object_id)
          order by q.created_at, q.id limit 1)
 where e.preset_object_id is not null;

update attend_trigger_objects t
   set preset_object_id = (
         select q.id from preset_objects q
          where q.model_url = (select p.model_url from preset_objects p where p.id = t.preset_object_id)
          order by q.created_at, q.id limit 1)
 where t.preset_object_id is not null;

update attend_rallies r
   set reward_preset_object_id = (
         select q.id from preset_objects q
          where q.model_url = (select p.model_url from preset_objects p where p.id = r.reward_preset_object_id)
          order by q.created_at, q.id limit 1)
 where r.reward_preset_object_id is not null;

update attend_rally_spots s
   set preset_object_id = (
         select q.id from preset_objects q
          where q.model_url = (select p.model_url from preset_objects p where p.id = s.preset_object_id)
          order by q.created_at, q.id limit 1)
 where s.preset_object_id is not null;

-- 参照を付け替えたので、各URLの2行目以降を消す
delete from preset_objects p
 where exists (
   select 1 from preset_objects q
    where q.model_url = p.model_url
      and (q.created_at, q.id) < (p.created_at, p.id)
 );

create unique index if not exists preset_objects_model_url_idx on preset_objects (model_url);


-- ------------------------------------------------------------
-- 4) 台帳を流し込む（これが本体）
--
--    public/presets/ に実在する473件を登録し、既にある行は
--    名前・カテゴリ・サムネ・service を正す。idは変えないので、
--    既存の注文や抽選セットの紐付けはそのまま残る。
--
--    shape: six    = 1等〜6等＋参加賞
--           four   = 大当たり/当たり/クーポン/はずれ＋参加賞
--           eleven = 上記すべて＋またね（2026-09に追加した24種）
--    has_mp4  : 透過MP4版があるか（この6カテゴリだけMP4素材がある）
--    has_thumb: サムネイルPNGがあるか
-- ------------------------------------------------------------
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
tier(key, ja, grp) as (values
  ('1tou',    '1等',     'six'),
  ('2tou',    '2等',     'six'),
  ('3tou',    '3等',     'six'),
  ('4tou',    '4等',     'six'),
  ('5tou',    '5等',     'six'),
  ('6tou',    '6等',     'six'),
  ('ohatari', '大当たり', 'four'),
  ('atari',   '当たり',   'four'),
  ('coupon',  'クーポン', 'four'),
  ('hazure',  'はずれ',   'four'),
  ('cookie',  null,      'cookie')
),
pair as (
  select c.value, c.label, c.has_mp4, c.has_thumb, t.key,
         -- クールダウン中に出すオブジェクトの呼び名は追加時期で違う
         coalesce(t.ja, case when c.shape = 'eleven' then 'またね' else '参加賞' end) as tier_ja
    from cat c
    join tier t
      on t.grp = 'cookie'
      or c.shape = 'eleven'
      or c.shape = t.grp
),
catalog(name, category, model_url, thumbnail_url) as (
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
   where p.has_mp4
)
insert into preset_objects (name, category, model_url, thumbnail_url, service)
select c.name, c.category, c.model_url, c.thumbnail_url, 'fukubiku'
  from catalog c
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
-- 6) 実体が無くなった行を掃除する
--
--    (2)を通ってもGIFのままの行は、MP4の用意が無いカテゴリの残骸で、
--    ファイルが存在しないため必ず表示できない。
--    どこからも参照されていないものだけ消す。
-- ------------------------------------------------------------
delete from preset_objects p
 where p.model_url like '/presets/%'
   and p.model_url like '%.gif'
   and not exists (select 1 from orders                 r where r.preset_object_id        = p.id)
   and not exists (select 1 from draw_group_entries     r where r.preset_object_id        = p.id)
   and not exists (select 1 from attend_trigger_objects r where r.preset_object_id        = p.id)
   and not exists (select 1 from attend_rallies         r where r.reward_preset_object_id = p.id)
   and not exists (select 1 from attend_rally_spots     r where r.preset_object_id        = p.id);


-- ------------------------------------------------------------
-- 7) 結果の確認
-- ------------------------------------------------------------
-- fukubiku_total が 473、gif_remaining と absolute_url_remaining と
-- service_null_remaining が 0 なら成功。
select
  count(*) filter (where service = 'fukubiku')                      as fukubiku_total,
  count(*) filter (where service = 'fukubiku' and model_url like '%.glb') as glb,
  count(*) filter (where service = 'fukubiku' and model_url like '%.mp4') as mp4,
  count(*) filter (where model_url like '%.gif')                    as gif_remaining,
  count(*) filter (where service = 'fukubiku' and model_url ~ '^https?://') as absolute_url_remaining,
  count(*) filter (where service is null)                           as service_null_remaining
from preset_objects;

-- カテゴリごとの内訳。53カテゴリが並び、glbが5〜11件、
-- amida/box/omikuji が7+7、darts/garagara/scratch が5+5 なら正常。
select category,
       count(*)                                       as total,
       count(*) filter (where model_url like '%.glb') as glb,
       count(*) filter (where model_url like '%.mp4') as mp4
  from preset_objects
 where service = 'fukubiku'
 group by category
 order by category;
