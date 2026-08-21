# Namara 基本設計書

> 対応する要件定義: [`requirements.md`](./requirements.md)

## 0. 本書の方針

Namaraは静的サイトであり、思想的にも技術的にも「小さいこと」が正しさである。

この設計書は、**とにかく早く動くサイトを作ること**を最優先する。

やらないこと：

* ビルドツール導入
* テンプレートエンジン
* 日替わりロジックの自動化
* 将来の拡張を見越した抽象化
* ロケール別（`/ja/` `/en/` 等）ディレクトリツリーによる多言語化（§1.5、否定的決定として記録済み）

要件定義 §21 の通り、Namara本体は「問題がどう追加されたか」を知らない。**存在する静的ファイルを表示するだけ**でよい。「今日の問題」の解決だけは例外的に、Cloudflare Pages Functions（`functions/_middleware.js`、§5.2）が日付を見て機械的にファイルを選ぶ。これは編集判断を含まない決定的なルーティングであり、CMSではない。担当者がやることは「日付つきファイルを1つ追加する」だけで、既存ファイルの上書きは発生しない（§9）。これにより、ブラウザ向けJS・ビルド・CMSを一切使わずにv1が完成する。

---

## 1. 「今日の問題」は12種類同時に存在する

構造上、Namaraには「言語 × 種別」の組み合わせ（4言語 × 3種別 = 12ページ）が常にすべて公開されている。つまり**サイト全体で1日1問**ではなく、

> **12種類の『今日のドリル』が並行して存在し、ユーザーは自分が維持したい言語・種別を1つ選んで触れる**

という設計である。

これは制約ではなく意図した仕様とする。理由：

* Cを普段使わない人に、Cの問題を強制する理由がない
* 「今日はRust/READ、明日はC++/DEBUG」のように、ユーザー自身が対象を選べる方が要件定義 §4 Skill Maintenance の思想に近い
* サイト全体で1つの問題に絞ろうとすると、「言語をどう選ぶか」という新しい決定ロジック（ローテーション、優先度、ランダム等）が必要になり、要件定義 §21 が明確に拒否している複雑さを呼び込む

要件定義 §1 の「1日1問」は、この12ページ構造と矛盾しないよう「1日1問を目安に、自分が維持したい言語・技能の問題へ触れる」という表現に修正済み（`requirements.md` 側を更新した）。

各ページが独立して「今日の問題」を名乗ってよい。ページ間で内容の整合性（同じ日に全ページを揃えて更新する、など）を取る必要はない。更新頻度もページごとにバラついてよい。

各組み合わせは、公開日ごとの固定ページ（アーカイブ）の集まりだけを持つ。「今日の問題」を指す専用ファイルは存在しない——`/c/read` のような日付なしURLは、最新の日付ページを指すエイリアスとしてミドルウェアが解決する。要件定義 §22、本書 §5.2・§7・§9 を参照。

---

## 1.5 ロケール別ディレクトリツリー（多言語化）はしない（否定的決定）

一時期、`/ja/{lang}/{type}/...` と `/en/{lang}/{type}/...` という2本のロケール別ツリーが存在した。**この構成は撤廃し、本書が一貫して前提とする単一の無プレフィックスツリー（`{lang}/{type}/...`、`<html lang="en">` 固定）に統合した。** 再発を防ぐため、判断の経緯をここに残す。

何が起きていたか：

* 問題ページを2ツリー分メンテナンスする必要があり、実際に更新が片方だけに入るドリフトの土壌になっていた（同じ情報を2箇所に置く設計は、置いた箇所の数だけ「更新を忘れる場所」を持つ）
* ルートパス `/` は常にミドルウェアが `Accept-Language` を見て `/ja/` か `/en/` へ302リダイレクトしており、`index.html` 本体（§6）が誰にも表示されない状態になっていた
* さらに古い時代には、ロケールを持たない無プレフィックスツリー（`c/read` 等）が別途存在した時期もあったが、`/ja/` `/en/` の追加後はどこからもリンクされずリンクグラフから孤立し、更新もされないまま放置された末に削除された。この削除自体も理由を記録しないまま行われており、「やらないと決めたことを記録しない」ことの再発コストを体現する事例になっていた

なぜやめたか：

* Namaraは元々「UI文言・問題文は英語で統一する」（§7.1）という単一言語設計だった。ロケール分割は、この前提を崩す複雑さを後から持ち込んだものであり、要件定義 §21 が明確に拒否している「将来の拡張を見越した抽象化」そのものだった
* 到達可能なページ・URLの数が増えることは、レビューすべき対象が増えることと同義である。誰にもリンクされないツリーは、更新もされず、誰の目にも入らないまま存在し続ける
* `/` のロケール判定リダイレクトは、エッジ（信頼境界）で動く `functions/_middleware.js` に、UI利便性のためだけの分岐を持ち込んでいた。ミドルウェアに残すべきなのは静的ファイルでは表現できない分岐（§5.1の未来日404、§5.2の「今日」エイリアス）だけであり、ロケール判定はそれに当たらない

今後の扱い：

* 多言語化そのものを永久に否定するわけではない。ただし再導入する場合は、**手作業のツリー複製ではなく**、単一の英語コンテンツから機械的に多言語版を生成・同期する仕組み（ビルド不要という制約下でなら、少なくともローカルの運用スクリプトによる決定的な変換）を前提に、改めて設計から検討すること
* 旧ロケールツリー（`/ja/*` `/en/*`）および旧 `fix` 型名への外部からの参照は、`functions/_middleware.js` の恒久リダイレクトで単一ツリーへ301誘導する。これはブックマーク・検索エンジンのインデックス保護のためだけの分岐であり、単一ツリー構成そのものには影響しない

---

## 2. 全体アーキテクチャ

```text
Browser
   ↓ HTTPS
Cloudflare Pages（静的ホスティング、ビルドコマンドなし）
   ↓
リポジトリ内の .html / .css ファイルをそのまま配信
```

* サーバーサイド処理なし
* API / DBなし
* クライアントJSなし

---

## 3. セキュリティ方針

### 3.1 前提：攻撃対象領域が構造的に小さい

Namaraには、一般的なWebアプリで問題になりやすい要素が最初から存在しない。

```text
JavaScript        なし
npm依存           なし
フレームワーク     なし
API               なし
DB                なし
ログイン           なし
フォーム送信       なし
ユーザー入力の保存  なし
```

正確に言うと、これは「JSなし＝安全」ということではなく、

> **動的処理を極端に減らした結果、攻撃可能な面がかなり小さい**

という状態である。ユーザー入力をDOMへ差し込む処理がないので一般的なXSSの入口がほぼなく、バックエンドがないのでSQL Injectionもなく、認証がないので認証突破もなく、npm依存がないのでJS依存パッケージ由来のサプライチェーンリスクも大きく減っている。

### 3.2 それでも残るリスク

一番現実的なのは、GitHubアカウントやCloudflareアカウントが乗っ取られ、HTMLそのものを書き換えられることである。これはJSの有無とは無関係で、静的サイトであっても常に残るリスクである（GitHub/Cloudflareアカウントの2段階認証などアカウント保護側で対処する話であり、Namaraのサイト設計そのものでは解決しない）。

また、将来HTMLに外部スクリプトや外部iframeを迂闊に追加すれば、その瞬間に外部依存・攻撃面が増える。そのため、次の原則を明文化する。

```text
外部JS       なし
外部CSS      なし
外部Font     なし
iframe       なし
analytics    なし
広告タグ     なし
```

`style.css` は自ホストの1枚のみ、フォントもシステムフォントのみを使う（§8参照）。これは意匠上の判断であると同時に、外部ホストへのリクエストを一切発生させないというセキュリティ上の判断でもある。

### 3.3 `_headers` によるセキュリティヘッダ

Cloudflare Pagesはリポジトリ直下に `_headers` ファイルを置くだけで、ビルド不要のままレスポンスヘッダを追加できる（[Headers · Cloudflare Pages docs](https://developers.cloudflare.com/pages/configuration/headers/)）。Namaraでは以下を設定する。

```text
/*
  Content-Security-Policy: default-src 'self'; script-src 'none'; object-src 'none'; frame-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

特に `script-src 'none'` が重要である。これはブラウザに対して「このサイトではJavaScriptの実行自体を許さない」と宣言するものであり、将来だれかが誤って（あるいは意図的に）HTMLに `<script>` を混入させても、ブラウザ側でブロックされる。設計判断を文書に書くだけでなく、ブラウザに強制させるところまでやる。

Cloudflare Pagesはデフォルトでも `X-Content-Type-Options: nosniff` 等の一部ヘッダを付与するが（[Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/)）、`_headers` で明示的に宣言することで、プラットフォームのデフォルト挙動に依存せず意図を固定する。

> **JSを使わないのは高速化・簡素化のためだけでなく、不要な実行能力をブラウザに与えないというセキュリティ上の利点でもある。**

Cloudflare Pagesの配信ルートはリポジトリ直下なので、`doc/`（要件定義書・本設計書）もそのままデプロイされ、クロール可能になる。これは製品コンテンツではないので、`_headers` に `/doc/*` へのパス限定ルールを追加し、`X-Robots-Tag: noindex, nofollow` で検索結果から除外する。robots.txtを持たない方針（§11）とは矛盾しない——アクセス自体は許可したまま、インデックスだけを止める指定である。

---

## 4. ディレクトリ構成

```text
namara/
├── index.html               # ルートページ本体。実コンテンツ（§6）。_redirectsは使わない
├── style.css                 # 全ページ共通スタイル（1枚のみ）
├── _headers                   # Cloudflare Pages のセキュリティヘッダ定義（§3.3）
├── 404.html                   # 存在しないパスに来た人向けの最小ページ
├── functions/
│   └── _middleware.js         # 日付つきURLの入口判定・「今日」エイリアスの解決（§5.2）
├── c/
│   ├── read/
│   │   ├── 2026-08-21.html     # 公開日ごとに増えるアーカイブ（1日1ファイル、公開後は編集しない）
│   │   └── archive.html        # 全日付への一覧（§7.1a）。新しい日を公開するたびに1行だけ編集する唯一の例外
│   ├── write/
│   │   └── 2026-08-21.html
│   └── debug/
│       └── 2026-08-21.html
├── cpp/                       # 同じパターン（read/ / write/ / debug/）
├── rust/                      # 同じパターン
├── haskell/                   # 同じパターン
└── doc/
    ├── requirements.md
    └── basic-design.md
```

`{lang}/{type}.html` のような日付なしファイルは存在しない。`read/`・`write/`・`debug/` ディレクトリも、最初のアーカイブが作られるまでは存在せず、1日目にアーカイブを作った時点で生まれる。

---

## 5. URL設計（ファイルパスとURLの対応）

Cloudflare Pagesは `.html` 拡張子付きのURLへアクセスがあった場合、拡張子なしのURLへ自動的にリダイレクトする（[Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/)）。つまり `rust/debug.html` というファイルを置いても、最終的に生きるURLは `/rust/debug` になる。アーカイブページも同じ規則に従う。

したがって：

* **ファイルは `.html` 拡張子付きのまま置く**（エディタでの編集しやすさを優先。ファイル名変更は不要）
* **HTML内のリンク（`<a href="...">`）は最初から拡張子なしで書く**
* **日付ファイル名は `YYYY-MM-DD.html`（ISO 8601）で統一する**。辞書順に並べればそのまま時系列順になり、ソートのための特別なロジックが要らない

対応表（例）：

| ファイル | 公開URL |
|---|---|
| `index.html` | `/` |
| `c/read/2026-08-20.html` | `/c/read/2026-08-20` |
| `c/read/2026-08-21.html` | `/c/read/2026-08-21` |
| （`c/read.html` のようなファイルは存在しない） | `/c/read` ← §5.2のエイリアスで解決 |
| `c/read/archive.html` | `/c/read/archive`（全日付への一覧、§7.1a） |

（`write` / `debug` および他の3言語も同じパターン。日付つきアーカイブは各組み合わせにつき公開日の数だけ増えていく。`archive` は日付の正規表現にもマッチしないため、§5.1・§5.2 のミドルウェア判定はそのまま素通りし、他の静的ファイルと同じ経路で配信される。）

### 5.1 未来日URLの扱い

アーカイブは常に「今日以前」の日付しか作らない。未来日のURL（例: `/c/read/2099-01-01`）を直接叩かれた場合も、静的ファイルの有無にかかわらず404にする。

ページ1枚ごとに判定コードを書くのではなく、Cloudflare Pages Functionsの `functions/_middleware.js` で全リクエストの入り口を一括判定する。

```text
Request
   ↓
functions/_middleware.js（日付を見て、未来日なら404を返す）
   ↓ 問題なければ context.next()
静的HTML配信（今まで通り）
```

### 5.2 「今日」エイリアス（日付なしURL）

`/c/read` のような日付なしURLには、対応する静的ファイルが存在しない。代わりに `functions/_middleware.js` が、そのURLへのリクエストを「今日の日付のアーカイブファイル」の内容にすり替えて返す。

```text
GET /c/read
   ↓
functions/_middleware.js が today = 2026-08-21 を計算
   ↓
env.ASSETS.fetch("/c/read/2026-08-21") を取得し、そのままレスポンスとして返す
   （URLバーは /c/read のまま。リダイレクトではなく透過的な差し替え）
```

これにより、新しい日の問題を公開する作業は「日付つきファイルを1つ追加するだけ」になる（§9）。以前のように「今日ページ」を毎回上書きし、その直前の内容をアーカイブへコピー＆リネームする、という手順は不要になった。アーカイブページ自身の `<link rel="canonical">` は常に日付つきURLを指す（§7）ため、`/c/read` と `/c/read/2026-08-21` が同一内容を返しても検索エンジンからは重複コンテンツとして扱われない。

今日のファイルがまだ存在しない場合（新しい日の問題をまだ公開していない場合）は、`env.ASSETS.fetch()` がそのまま404を返す。「今日の問題が見えなくなる」事態を防ぐのは運用側の責務であり、ミドルウェア側でフォールバック（前日分を代わりに出す等）は行わない——それを始めると「今、何日の問題が表示されているか」が場合によって変わる曖昧な仕組みになり、§0の方針（小さいこと・単純であること）に反する。

これはCloudflareのエッジ（サーバー側）で動くコードであり、ブラウザに配信されるJSではない。したがって `_headers` の `script-src 'none'`（§3.3）とは無関係で、矛盾しない。**ブラウザにJSの実行能力を渡さない、という方針はこの先も変わらない。**

---

## 6. ルートページ（`/`）と `404.html`

以前の設計では、Cloudflare Pagesの `_redirects` を使って `/` を `/c/read` へ転送していた。**これはやめる。**

理由：

* リダイレクトだけのページは検索エンジンにとって実質空白であり、「Namara」という名前や考え方そのもので見つけてもらう機会を捨てることになる
* 「今日の問題」はもともと12種類同時に存在する（§1）。`/c/read` を特別扱いしてデフォルトにする必然性は薄かった
* トップページに実コンテンツを置いたほうが、初めて来た人に「これは何のサイトか」を説明できる

`index.html` は、次の要素を持つ独立したページとする。

1. header（サイト名・タグライン）— 他ページと共通
2. 短い説明文（Namaraが何か、何をしないか。要件定義 §1〜§3 の要約）
3. 言語 × 種別への案内（4言語 × 3種別、12リンク）
4. footer

具体例（プレースホルダーではなく、そのまま使える文章として書いた）：

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="description" content="Namara is a one-question-a-day coding drill in C, C++, Rust, and Haskell — for programmers who want to keep reading, writing, and fixing code by hand.">
<title>Namara — Code daily. Without assist.</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div class="wrap">

<header class="masthead">
  <h1>Namara</h1>
  <p class="tagline">Code daily. Without assist.</p>
</header>

<p class="lede">
  Namara is a one-question-a-day coding drill for programmers who already know how to code, and want to make sure they still can.
</p>

<p>
  No compiler, no login, no score. Pick a language and an exercise type below, read a small piece of code, and see if you still reach the answer without help.
</p>

<section class="guide">
  <h2>Choose a drill</h2>
  <p><strong>C</strong> &mdash; <a href="/c/read">READ</a> &middot; <a href="/c/write">WRITE</a> &middot; <a href="/c/debug">DEBUG</a></p>
  <p><strong>C++</strong> &mdash; <a href="/cpp/read">READ</a> &middot; <a href="/cpp/write">WRITE</a> &middot; <a href="/cpp/debug">DEBUG</a></p>
  <p><strong>Rust</strong> &mdash; <a href="/rust/read">READ</a> &middot; <a href="/rust/write">WRITE</a> &middot; <a href="/rust/debug">DEBUG</a></p>
  <p><strong>Haskell</strong> &mdash; <a href="/haskell/read">READ</a> &middot; <a href="/haskell/write">WRITE</a> &middot; <a href="/haskell/debug">DEBUG</a></p>
</section>

<footer>
  <p>A daily maintenance routine for programmers.</p>
</footer>

</div>
</body>
</html>
```

以前は「`_redirects` が先に効くのでほぼ誰も見ない」という位置づけだったが、`_redirects` 自体をやめたので、`404.html` は純粋に「存在しないパスに来た人向け」の実用ページになる。

見た目は既存のコンポーネント（`.code-frame` / `pre.code` / `.question`）をそのまま流用し、コンパイラのエラー出力ふうに組む。新しいCSSは増やさない。

```html
<main>
  <h2>404</h2>

  <div class="code-frame">
    <p class="code-filename">not_found</p>
    <pre class="code"><code>error: page not found
 --&gt; the path you followed
  |
  = note: no such route in this crate
</code></pre>
  </div>

  <p class="question">
    That page doesn't exist. It may have moved, or never did.
  </p>

  <p><a href="/">&larr; Back to Namara</a></p>
</main>
```

`.wrap` を使う（`.page` ではない）。404ページは特定の言語・種別に属さないため、nav も past ペインも持たない。

---

## 7. HTMLページ規約

### 7.1 問題ページ（例: `c/read/2026-08-21.html`）

問題ページは常に日付つきで、公開したら二度と編集しない。「今日ページ」という別種のファイルは存在しない——`/c/read` への日付なしアクセスは、ミドルウェアが最新の日付ページを差し替えて返すエイリアスである（§5.2）。そのため、ここで書く規約が全ての問題ページに一律で適用される。

構成要素の順番：

1. header（サイト名・タグライン）
2. language navigation
3. exercise navigation
4. code（エディタ風の枠。左上にお題に沿ったファイル名を置く）
5. question
6. details（Answer / Reference）
7. past（他の日付へのリンク。まだ他になければ `Today` リンクだけになる）
8. footer

具体例：

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Namara — C / READ — 2026-08-21</title>
<link rel="canonical" href="https://namara.jocarium.productions/c/read/2026-08-21">
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div class="page">

<header class="masthead">
  <h1><a href="/">Namara</a></h1>
  <p class="tagline">Code daily. Without assist.</p>
</header>

<nav class="lang-nav" aria-label="Language">
  <a href="/c/read/2026-08-21" class="active" aria-current="page">C</a>
  <a href="/cpp/read/2026-08-21">C++</a>
  <a href="/rust/read/2026-08-21">Rust</a>
  <a href="/haskell/read/2026-08-21">Haskell</a>
</nav>

<nav class="type-nav" aria-label="Exercise type">
  <a href="/c/read/2026-08-21" class="active" aria-current="page">READ</a>
  <a href="/c/write/2026-08-21">WRITE</a>
  <a href="/c/debug/2026-08-21">DEBUG</a>
</nav>

<main>
  <h2>2026-08-21</h2>

  <div class="code-frame">
    <p class="code-filename">compare.c</p>
    <pre class="code"><code>&lt;!-- ここにコード。&lt; &gt; &amp; は必ずHTMLエスケープする --&gt;
</code></pre>
  </div>

  <p class="question">
    ここに問い（例: 「この式は何に評価されるか」）
  </p>

  <details class="answer">
    <summary>Answer</summary>
    <p>ここに答えと最小限の解説</p>
  </details>
</main>

<aside class="past">
  <h2>Past</h2>
  <ul class="past-list">
    <li><a href="/c/read">Today</a></li>
    <li><a href="/c/read/archive">Archive</a></li>
  </ul>
</aside>

<footer>
  <p>A daily maintenance routine for programmers.</p>
</footer>

</div>
</body>
</html>
```

`<body>` 直下は `<div class="wrap">` ではなく `<div class="page">` を使う。`.page` はCSS Gridで「本体（header / nav / main / footer）＋ 右側のPastペイン」の2カラムを組む。40rem未満の画面では自動的に1カラムへ積み上がる（`main`の次に`past`、その次に`footer`という順）。これは要件定義 §18 のUIモックアップに、日付をクリックするとその日の問題が読める仕組みを足したもので、JSは使わない（CSS Gridのみ）。詳細は §8 を参照。

ルール：

* `<title>` は `Namara — {言語} / {種別} — {日付}` に統一
* `<h2>` はその日付そのもの（例: `2026-08-21`）にする。何の問題かは nav・title・code-filename で分かるので、見出しは「いつのものか」を示せば十分
* `<html lang="en">` を使う（UI文言・問題文は英語で統一しているため）
* masthead の `<h1>` は `/`（ルートページ）へリンクする
* リンクはすべて拡張子なし（§5）。日付なしURL（`/c/read` 等）へのリンクは、書いた時点でその日の内容そのものを指しているわけではなく、常に「そのとき最新」を指すという点を意識する
* `lang-nav` / `type-nav` は同じ日付を保ったまま言語・種別だけを切り替える（例: `/c/write/2026-08-21` → `/rust/write/2026-08-21`）。現在地のリンクにだけ `class="active"` と `aria-current="page"` を手動で付ける
* コードは `<div class="code-frame">` で囲み、直下の `<p class="code-filename">` にお題に沿ったファイル名を、対象言語の命名規則で書く（C/C++/Rustはsnake_case、Haskellはモジュール名慣習のPascalCase）。以前あった `<p class="path">/* c/read */</p>` のようなコメント演出は廃止した
* WRITEページは `<summary>Answer</summary>` を `<summary>Reference</summary>` に変える（要件定義 §9 WRITEの節）
* コード内の `<` `>` `&` は `&lt;` `&gt;` `&amp;` に置換してから貼る
* `past-list` は常に2行固定：`Today` リンク（日付なしURL）と `Archive` リンク（`/{lang}/{type}/archive`、§7.1a）。日付を直接列挙しない。これにより **この2行はどの日付のページでも同じ内容になり、公開後のページは本当に一度も編集しない**（旧版は全過去日付を降順で列挙しており、新しい日を公開するたびに既存アーカイブ全ページの編集が必要だった。§7.1a 参照）

### 7.1a アーカイブ一覧ページ（例: `c/read/archive.html`）

`{lang}/{type}` の組み合わせごとに1枚、その組み合わせの全アーカイブ日付を新しい順に列挙するページを置く（4言語 × 3種別 = 12枚）。日付ページからは `past-list` の `Archive` リンクでここへ来る。

構成要素は日付ページ（§7.1）とほぼ同じだが、次の点が異なる：

* `<main>` の中身は `code-frame` / `question` / `answer` ではなく、`<h2>Archive</h2>` と `past-list` 形式の `<ul>` のみ（`.past-list` はスコープなしのクラスなので `<aside>` の外でもそのまま使える。追加CSSは不要）
* この `<ul>` が全日付の一覧そのものなので、ページ自身は `<aside class="past">` を持たない（`.page:not(:has(.past))` により自動で1カラムへ戻る。§8）
* `lang-nav` / `type-nav` は日付を保持できないので、兄弟の archive ページ（例: `/rust/read/archive`）へリンクする
* JSON-LDは `BreadcrumbList` のみとし、`TechArticle` / `LearningResource` は付けない（ドリル本体ではなく索引のため）
* `<title>` は `Namara — {言語} / {種別} — Archive`、`<h2>` は `Archive`

具体例：

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="description" content="Every past Namara C READ drill, archived by date.">
<title>Namara — C / READ — Archive</title>
<link rel="canonical" href="https://namara.jocarium.productions/c/read/archive">
<link rel="stylesheet" href="/style.css">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Namara", "item": "https://namara.jocarium.productions/" },
    { "@type": "ListItem", "position": 2, "name": "C / READ", "item": "https://namara.jocarium.productions/c/read" },
    { "@type": "ListItem", "position": 3, "name": "Archive" }
  ]
}
</script>
</head>
<body>
<div class="page">

<header class="masthead">
  <h1><a href="/">Namara</a></h1>
  <p class="tagline">Code daily. Without assist.</p>
</header>

<nav class="lang-nav" aria-label="Language">
  <a href="/c/read/archive" class="active" aria-current="page">C</a>
  <a href="/cpp/read/archive">C++</a>
  <a href="/rust/read/archive">Rust</a>
  <a href="/haskell/read/archive">Haskell</a>
</nav>

<nav class="type-nav" aria-label="Exercise type">
  <a href="/c/read/archive" class="active" aria-current="page">READ</a>
  <a href="/c/write/archive">WRITE</a>
  <a href="/c/debug/archive">DEBUG</a>
</nav>

<main>
  <h2>Archive</h2>
  <ul class="past-list">
    <li><a href="/c/read/2026-08-21">2026-08-21</a></li>
    <li><a href="/c/read/2026-08-20">2026-08-20</a></li>
  </ul>
</main>

<footer>
  <p>A daily maintenance routine for programmers.</p>
  <p><a href="https://github.com/kokimiza/namara/issues">Spot a mistake? Fix it on GitHub.</a></p>
</footer>

</div>
</body>
</html>
```

新しい日を公開するたびに触るのはこのファイル**だけ**（対応する `{lang}/{type}` の archive.html 1枚に、新しい日付の `<li>` を先頭へ1行足す）。**これが「公開後は編集しない」の唯一かつ明示的な例外である。** それ以外の（日付つきの）アーカイブページは、公開後は本当に一度も編集されない。

> **原則：ページ間のHTML重複は意図的に許容する。** 12ページ間の重複（既出）に加えて、日付ページどうしの構造重複も同様に許容する。重複除去のためだけにビルド処理・テンプレートエンジン・JavaScriptを導入しない。

### 7.2 ルートページ（`index.html`）

§6 を参照。他の12ページと同じ `header` / `footer` は流用するが、`nav`（lang-nav / type-nav）は持たない。ルートページ自体はどの言語・種別にも属さないため。

---

## 8. スタイル設計（`style.css`）

優先順位は要件定義 §19 の通り：①コード可読性 → ②問題文可読性 → ③答え可読性 → ④モバイル → ⑤ブランド。

方針だけ決め、細部は実装時に詰める：

* 本文フォント: システムフォントスタック（`-apple-system, "Segoe UI", sans-serif` 等）。外部フォント読み込みはしない（§3.2）
* コードフォント: `ui-monospace, "SFMono-Regular", Consolas, monospace`
* `pre.code`: 横スクロール可（`overflow-x: auto`）、折り返さない、背景をわずかに区別する程度
* ルートページ・404ページ（`.wrap`）は1カラム、`max-width: 640px` 程度の中央寄せコンテナ
* 問題ページ（`.page`）は `max-width: 864px` 程度。CSS GridでPastペインを右側に置く。40rem未満の画面では自動的に1カラムへ積み上がる（メディアクエリを1つだけ使う。「PC用CSSとモバイル用CSSを分ける」のではなく、2カラムという構造そのものが狭い画面には物理的に収まらないための、機能上必要な分岐）
* Pastペインが存在しない（アーカイブが1件もない）ページは、CSSの `:has()` で検知して自動的に1カラムへ戻す。HTML側で場合分けを書く必要はない
* アニメーション・トランジションなし
* 色数を絞る（背景1色・文字1色・アクセント1色程度）
* `nav a.active` / `.past-list .current` は色とウェイト変更程度の控えめな強調のみで統一する

ファイル冒頭には最小限のリセットを置く（`box-sizing: border-box`と、実際に使っている要素——`html` / `body` / `h1` / `h2` / `p`——の余白ゼロのみ）。Namaraのページに存在しない要素（画像・table・フォーム・リスト等）のリセットは書かない。将来使うかもしれない要素への予防的なリセットはしない。リセットは汎用部分として先頭にまとめ、Namara固有のトークン適用（背景色・文字色・フォント）はその直後の「Base」セクションに分離する。

`past`（問題ページ）や `guide`（ルートページ）のセクションは、`h2` / `p` / `a` / `strong` の範囲に収まる。新しい要素（画像・リスト・テーブル等）を増やさずに書けるため、追加のリセットは不要。

CSSファイルは1枚のみとし、ページ側の `<link>` は共通で `/style.css` を指す。

---

## 9. コンテンツ運用フロー

```text
1. 問題を1つ作る（言語・種別・code・question・answerを決める）
2. {lang}/{type}/{今日の日付}.html を新規作成する（例: c/read/2026-08-21.html）
   - §7.1の規約に沿って code / question / answer を書く
   - <title>・<h2> の日付を今日の日付にする
   - code-filename にお題に沿ったファイル名（対象言語の命名規則）を書く
   - コードは HTML エスケープする
   - Past ペインは常に固定の2行（「Today」リンク＋「Archive」リンク、§7.1）
3. 同じ {lang}/{type} の archive.html（§7.1a）に、手順2で作ったページへのリンクを
   先頭へ1行追加する（例: `<li><a href="/c/read/2026-08-21">2026-08-21</a></li>`）
4. git commit
5. git push
6. Cloudflare Pages が自動デプロイ
```

「今日ページ」という別ファイルは存在しないため、上書きするファイルは無い。手順2で新規作成したファイルは、以後二度と編集しない。`/c/read` のような日付なしURLは、ミドルウェア（§5.2）が常に最新の日付ページへ自動的に解決するので、公開のたびに触るのは「新しい日付のファイルを1つ追加する」ことと「対応する archive.html 1枚に1行足す」ことだけになる——過去日の日付ページ自体は増えても触らない（§7.1a）。

新しい言語・種別を追加することは v1 の想定に含まれない（要件定義 §8 で4言語固定、§9 で3種別固定）。

---

## 10. Cloudflare Pages 設定

ビルドが実質不要な構成のため、UI上の項目は以下の方針で設定する。実際にCloudflare UIで確定した値は、このあと実測定値として本節を更新すること。

```text
Framework preset: None
Build command: 空欄（またはCloudflare UIが提示する推奨設定。値が必要な場合は `exit 0` 等の no-op でよい）
Build output directory: 静的ファイルを置いたディレクトリ（このリポジトリでは直下 = リポジトリルート想定）
Root directory: リポジトリルート
```

---

## 11. v1で作らないもの（確認のみ）

要件定義 §23 と一致。設計上ここに迷いを残さない。

```text
JavaScript
ビルドツール / テンプレートエンジン
バックエンド / API / DB
「今日の問題」自動選出ロジック
ユーザー管理・ログイン
実行環境（Run/Compiler/REPL等）
採点・スコア・Streak
ランキング・SNS機能
CMS
sitemap.xml / robots.txt
```

`sitemap.xml` はSEOの定石ではあるが、日付アーカイブが増えるたびに手動更新が必要になり、ビルドツールなしでは維持し続けるコストが割に合わない。トップページの案内（§6）・各ページの nav・Past リストという内部リンクだけで、検索エンジンは十分に全ページへ到達できる。

なお、ここで作らない「履歴」はユーザー個人の解答履歴・進捗であり、問題コンテンツ自体のアーカイブ（§7.1、§9）とは別物である（要件定義 §17、§22）。

---

## 12. 最短で動かすための手順（Definition of Done）

以下が揃えば「動くNamara」として成立する。中身の問題文はプレースホルダーでよく、後から差し替えれば良い。

1. `style.css` を1枚作る（§8の方針で最小限）
2. `index.html` を実コンテンツで作る（§6）
3. `_headers` を作る（§3.3）
4. `404.html` を最小限の内容で作る（§6）
5. `functions/_middleware.js` を作る（§5.1・§5.2：未来日404、および「今日」エイリアスの解決）
6. §7.1の規約を元に、12組（4言語 × 3種別）それぞれの初日のアーカイブページ（例: `c/read/2026-08-21.html`）をプレースホルダー内容で作成する。Past ペインは「Today」リンク＋現在地だけになる
7. GitHubリポジトリを作成し、上記一式をpush
8. Cloudflare PagesとGitHubリポジトリを接続し、§10の設定でデプロイ
9. `/` を開いて、Namaraの説明文と12個の案内リンクが表示されることを確認する
10. `/c/read`（ミドルウェアが今日の日付ページへ差し替えるエイリアス）と `/c/read/2026-08-21`（そのページ自体の固定URL）の両方に、`.html` なしで直接アクセスでき、同じ内容が表示されることを確認する
11. 画面幅が40rem以上のとき、問題ページの右側にPastペインが表示され、日付をクリックするとその日のページに切り替わることを確認する（JS不使用、ページ遷移のみ）
12. レスポンスヘッダに `Content-Security-Policy` 等が付与されていることを確認する（ブラウザの開発者ツール／`curl -I`）。手順10の `/c/read` エイリアス側でもヘッダが同様に付与されることを確認する

ここまでで公開可能。以降の作業は「問題の中身を良くしていくこと」だけになり、それは要件定義 §24 の言う通りNamaraの本質的な資産である。
