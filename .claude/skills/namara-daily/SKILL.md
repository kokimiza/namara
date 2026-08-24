---
name: namara-daily
description: Namaraの新しい1問を、指定されたお題（言語・種別・トピック）に沿って作成する。script/content.shで雛形を生成し、code/question/answerを書き、検証する。「今日のNamara書いて」「RustのWRITEで所有権の問題作って」のような依頼で使う。
---

# Namara — 日々のドリル作成

あなたはNamaraの編集者としてふるまう。Namaraは「JS・ビルドツールなし、静的HTML」の
コーディングドリルサイトで、1日1問を目安に C / C++ / Rust / Haskell × READ / WRITE / DEBUG
の12組を公開している。このSkillは、そのうち1問（または複数問）を実際に書く作業を担う。

**必ず最初に** `doc/basic-design.md`（特に §1、§7.1、§7.1a、§9、§24）と
`doc/requirements.md`（特に §7〜§12「良い問題」の基準）を読むこと。まだ読んでいない
セッションで呼ばれた前提で、思い出すのではなく必ず実際に読む。

## 0. お題の解釈

呼び出し時の引数（`args`）から、次の3つを読み取る。厳密な書式は要求しない
（「rust write 所有権の移動」でも「今日はC++のDEBUGでコンストラクタ順について」でもよい）。

* **言語**: c / cpp / rust / haskell のいずれか
* **種別**: read / write / debug のいずれか
* **トピック**: 何を扱うか（自由記述。「所有権」「switchのfallthrough」等）
* **日付**（省略可）: 省略時は `TZ=Asia/Tokyo date +%Y-%m-%d` で得られる今日の日付

複数組（例:「C++のDEBUGとHaskellのWRITE」）が指定されたら、それぞれについて
このSkill全体の手順を独立に繰り返す。

**言語・種別・日付のいずれかが読み取れない場合は、推測で埋めずAskUserQuestionで確認する。**
トピックが完全に自由（「何でもいいから1問」）なら、対象の `{lang}/{type}/archive.html` を見て
直近に扱ったトピックと重複しないものを自分で選んでよい——その場合も選んだトピックを
最終報告で明示する。

## 1. 雛形生成（script/content.shを使う）

Bashで実行する。上書きはしない・冪等なので、同じ日付で再実行しても安全。

```bash
./script/content.sh new <DATE> <lang>/<type>
```

* 出力が `created: ...` なら新規雛形ができている。`skip (already exists): ...` の場合は
  既にそのファイルが存在する——**中身を確認**し、`TODO:` が残っていなければ既に公開済みの
  本物のページなので、そのまま上書きせず、日付をずらすか、対象を変えるかをユーザーに確認する
  （公開後のページは編集しない、という方針は最優先で守る。§7.1）。
* `archived: ...` で対応する `archive.html` にも自動で1行追加されている。この行は自分で
  触らない（スクリプトが冪等に処理済み）。

## 2. 直近ページをスタイルの参考にする

同じ `{lang}/{type}/` ディレクトリの直近1〜2件（`ls {lang}/{type}/2*.html | sort | tail -2`）を
読み、次を体で覚える：

* `code-filename` の命名規則（C/C++/Rustはsnake_case、Haskellはモジュール名慣習のPascalCase）
* 問題文・解説文の分量感とトーン
* READ/WRITE/DEBUGそれぞれの `<details>` の型（WRITEは`<summary>Reference</summary>`＋参考実装の`<pre>`＋説明の`<p>`、READ/DEBUGは`<summary>Answer</summary>`＋説明の`<p>`のみ）

## 3. 中身を書く（唯一の創造的な作業）

雛形ファイル（`{lang}/{type}/{date}.html`）の `TODO:` を全て埋める。Editツールを使うこと
（雛形全体をWriteで作り直さない——nav/JSON-LD/footerは既に正しく生成済み）。

**言語の使い分け（このリポジトリの確定ルール、doc/basic-design.md §1.5 参照）**:

* `<p class="question">` の本文、`<div class="answer-body">` 内の説明文(`<p>`) → **日本語**
* それ以外すべて（`<title>`、`meta description`、JSON-LD、`code-filename`、コード本体とその
  コメント、nav、`<summary>Answer</summary>`/`<summary>Reference</summary>`ラベル、footer） →
  **英語のまま**
* `<html lang="ja">` は雛形の時点で既にセット済み。触らない
* JSON-LDの `"inLanguage"` は `"ja"` のまま（雛形は既にそうなっている）

**問題の質の基準**（doc/requirements.md §7・§9・§11、doc/basic-design.md §24を必ず踏まえる）:

* READ: 答えが言語仕様上明確なこと。未定義動作・処理系依存の挙動を「何が出力される？」で
  問わない（それはDEBUG向き）
* WRITE: 唯一の正解がない場合、掲載する実装は「参考実装(Reference)」として書き、
  「これが唯一の正解ではない」旨に触れる
* DEBUG: 実務で起きうる最小限のバグ。直し方も最小限の変更で
* 知識マウントにしない。「ああ、そうだった」を生む問題を選ぶ。既存アーカイブと話題が
  かぶらないよう、手順2で見た直近ページと露骨に同じ切り口は避ける
* コード中の `<` `>` `&` は必ず `&lt;` `&gt;` `&amp;` にエスケープする
* `code-filename` はお題に沿った名前を、対象言語の命名規則で

`meta description` と JSON-LDの `description`/`about.name` も、TODOのままにせず英語で
具体的に埋める（他の既存ページに倣う——「An archived Namara {LANG} {TYPE} drill from {DATE}: ...」の形）。

## 4. 検証

編集後、必ず次を実行して確認する（このリポジトリでこれまで使ってきた検証方法と同じ）。

```bash
# JSON-LDが壊れていないか
python3 -c "
import re, json
html = open('{lang}/{type}/{date}.html', encoding='utf-8').read()
m = re.search(r'<script type=\"application/ld\+json\">\s*(\{.*?\})\s*</script>', html, re.S)
json.loads(m.group(1))
print('JSON-LD OK')
"

# TODOが残っていないか
grep -n 'TODO' {lang}/{type}/{date}.html && echo "まだTODOが残っています" || echo "TODOなし"

# lang-nav/type-navの整合性（他ページと同じ日付・同じ言語のリンクになっているか）
grep -A6 'class="lang-nav"' {lang}/{type}/{date}.html
grep -A6 'class="type-nav"' {lang}/{type}/{date}.html
```

「TODOが残っています」が出た場合は§3に戻ってやり直す。

## 5. 報告して止める

`git add -A` はしてよいが、**commitはしない**。最後に日本語で短く報告する：

* 対象（言語/種別/日付）とトピック
* 新規作成したファイルと、`archive.html` に追加された行
* 検証結果（JSON-LD OK / TODOなし / nav整合）
* commitするかどうかはユーザーの判断を仰ぐ

複数combo分まとめて処理した場合は、comboごとに上記を繰り返し、最後に全体のまとめを1つ添える。
