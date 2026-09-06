-- あてんどの発火条件に NFC を追加する。
--
-- NFCタグ自体はURLを開くだけなので、「開いた時点で発火」という条件として扱う。
-- マーカーも位置も見ずに、カメラ映像の手前にオブジェクトを表示する。
--
-- 既存の check 制約を張り替える(制約名はテーブル名_列名_check が既定)。
alter table attend_triggers drop constraint if exists attend_triggers_display_type_check;
alter table attend_triggers add constraint attend_triggers_display_type_check
  check (display_type in ('aframe', 'mindar_image', 'mindar_face', 'gps', 'nfc'));
