-- ============================================================
-- fukubiku テンプレート台帳の再構築（何度でも実行可・冪等）
--
-- これ1本で preset_objects を「アプリに実在するテンプレート840件」と
-- 一致した状態へ戻します。seed_presets.sql / seed_object_presets.sql 〜 v7.sql の
-- どれを実行済みかを気にする必要はありません。
--
-- 2026-09 更新: 全73カテゴリ(うち20種は新規)で10等級（1等〜6等／大当たり・当たり・クーポン・
-- はずれ）が選べるようになりました。実行すると管理画面の選択肢が増えます。
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
--    public/presets/ に実在する840件を登録し、既にある行は
--    名前・カテゴリ・サムネ・service を正す。idは変えないので、
--    既存の注文や抽選セットの紐付けはそのまま残る。
--
--    2026-09: 全73カテゴリで 1等〜6等 と 大当たり/当たり/クーポン/はずれ の
--    10等級すべてを選べるようにした（以前はカテゴリごとに6種または4種しか
--    無かった）。.glb は tools/templates/ の build.py / build_v2.py が生成する。
--    サムネイルPNGも tools/thumbs/render.py で全件そろえてある。
--
--    mp4_grp : 透過MP4素材がある等級グループ（この6カテゴリだけMP4がある。
--              MP4は元の等級ぶんしか無いので、その範囲だけ登録する）
-- ------------------------------------------------------------
with cat(value, label, mp4_grp) as (values
  ('amida', 'あみだくじ', 'six'),
  ('box', 'ボックス抽選', 'six'),
  ('darts', 'ダーツ', 'four'),
  ('garagara', 'ガラガラ抽選', 'four'),
  ('omikuji', 'おみくじ', 'six'),
  ('scratch', 'スクラッチ', 'four'),
  ('roulette', 'ルーレット', null),
  ('dice', 'サイコロ', null),
  ('treasure', '宝箱', null),
  ('slot', 'スロット', null),
  ('gacha', 'ガチャガチャ', null),
  ('mallet', '打ち出の小槌', null),
  ('cat', '招き猫', null),
  ('daruma', 'だるま', null),
  ('lantern', 'ランタン', null),
  ('firework', '打ち上げ花火', null),
  ('airlottery', 'エアー抽選機', null),
  ('fan', '扇子', null),
  ('pachinko', 'パチンコ', null),
  ('jet', '戦闘機の的撃ち', null),
  ('rocket', 'ロケット発射', null),
  ('meteor', '隕石落下', null),
  ('shuriken', '手裏剣ヒット', null),
  ('dragon', '龍が玉を掴む', null),
  ('iaido', '居合斬り', null),
  ('ufo', 'UFOビーム', null),
  ('cannon', '大砲・クラッカー砲', null),
  ('thunder', '雷神の一撃', null),
  ('punch', '超パンチ', null),
  ('sankaku', '三角くじ', null),
  ('ema', '絵馬', null),
  ('kagamibiraki', '鏡開き', null),
  ('xmas', 'クリスマス', null),
  ('vending', '自動販売機', null),
  ('receipt', 'レシート', null),
  ('ring', '輪投げ', null),
  ('safe', '金庫', null),
  ('fukubukuro', '福袋', null),
  ('sakura', '桜', null),
  ('mamemaki', '豆まき', null),
  ('otoshidama', 'お年玉', null),
  ('crane', 'クレーンゲーム', null),
  ('mogura', 'もぐらたたき', null),
  ('bowling', 'ボウリング', null),
  ('makimono', '巻物', null),
  ('shateki', '射的', null),
  ('kingyo', '金魚すくい', null),
  ('kakigori', 'かき氷', null),
  ('halloween', 'ハロウィン', null),
  ('valentine', 'バレンタイン', null),
  ('tanabata', '七夕', null),
  ('sushi', '回転寿司', null),
  ('taiyaki', 'たい焼き', null),
  ('kusudama', 'くす玉', null),
  ('bingo', 'ビンゴ', null),
  ('striker', '力試しハンマー', null),
  ('soccer', 'サッカーPK', null),
  ('basketball', 'バスケットボール', null),
  ('crystal', '水晶玉占い', null),
  ('giftbox', 'プレゼント箱', null),
  ('suikawari', 'スイカ割り', null),
  ('snowman', '雪だるま', null),
  ('tako', '凧揚げ', null),
  ('koinobori', 'こいのぼり', null),
  ('tsukimi', 'お月見', null),
  ('furin', '風鈴', null),
  ('jubako', '重箱（おせち）', null),
  ('ramen', 'ラーメン', null),
  ('coffee', 'コーヒー', null),
  ('toaster', 'トースター', null),
  ('beer', 'ビール', null),
  ('cake', 'ケーキ', null),
  ('pizza', 'ピザ', null)
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
  -- どのカテゴリでも 1等〜6等 と 大当たり/当たり/クーポン/はずれ の
  -- 10種すべてを選べるようにする(不足していた.glbは
  -- tools/badge/expand_tiers.py で生成済み)。
  -- cookie は「参加賞」。どのカテゴリの <cat>_cookie_3d.glb も
  -- 「参加賞」のバッジが入っているので、呼び名をそれに揃える。
  select c.value, c.label, c.mp4_grp, t.key, t.grp,
         coalesce(t.ja, '参加賞') as tier_ja
    from cat c
    join tier t on true
),
catalog(name, category, model_url, thumbnail_url) as (
  -- 3Dオブジェクト。サムネイルは tools/thumbs/render.py が全件生成済み。
  select p.label || ' - ' || p.tier_ja || '（3Dオブジェクト）',
         p.value,
         '/presets/' || p.value || '/' || p.value || '_' || p.key || '_3d.glb',
         '/presets/' || p.value || '/' || p.value || '_' || p.key || '_3d_thumb.png'
    from pair p
  union all
  -- 透過MP4。元からMP4素材があるカテゴリの、素材が実在する等級だけ。
  select p.label || ' - ' || p.tier_ja,
         p.value,
         '/presets/' || p.value || '/' || p.value || '_' || p.key || '.mp4',
         null
    from pair p
   where p.mp4_grp is not null
     and (p.grp = p.mp4_grp or p.grp = 'cookie')
  union all
  -- 全カテゴリ共通の「またね」(クールダウン中の表示)
  select '共通 - またね（3Dオブジェクト）', 'common',
         '/presets/common/common_cookie_3d.glb',
         '/presets/common/common_cookie_3d_thumb.png'
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
-- fukubiku_total が 840（glb 804 + mp4 36）、gif_remaining と
-- absolute_url_remaining と service_null_remaining が 0 なら成功。
select
  count(*) filter (where service = 'fukubiku')                      as fukubiku_total,
  count(*) filter (where service = 'fukubiku' and model_url like '%.glb') as glb,
  count(*) filter (where service = 'fukubiku' and model_url like '%.mp4') as mp4,
  count(*) filter (where model_url like '%.gif')                    as gif_remaining,
  count(*) filter (where service = 'fukubiku' and model_url ~ '^https?://') as absolute_url_remaining,
  count(*) filter (where service is null)                           as service_null_remaining
from preset_objects;

-- カテゴリごとの内訳。73カテゴリ＋common が並び、
-- 各カテゴリ glb=11、amida/box/omikuji は mp4=7、
-- darts/garagara/scratch は mp4=5、common は glb=1 なら正常。
select category,
       count(*)                                       as total,
       count(*) filter (where model_url like '%.glb') as glb,
       count(*) filter (where model_url like '%.mp4') as mp4
  from preset_objects
 where service = 'fukubiku'
 group by category
 order by category;
