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

要件定義 §21 の通り、Namara本体は「問題がどう追加されたか」を知らない。**存在する静的ファイルを表示するだけ**でよい。したがって「今日の問題」を自動選出する仕組みは持たず、担当者がファイルを直接書き換える運用とする。これにより、JS・ビルド・CMSを一切使わずにv1が完成する。

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

各ページが独立して「Today's code」を名乗ってよい。ページ間で内容の整合性（同じ日に全ページを揃えて更新する、など）を取る必要はない。更新頻度もページごとにバラついてよい。

各組み合わせは、その時点の最新問題を表示する1ページ（今日ページ）に加えて、過去に公開した問題を日付ごとに読めるページの集まり（アーカイブ）を持つ。要件定義 §22、本書 §7.2・§9 を参照。

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
├── c/
│   ├── read.html               # 「今」のC/READ問題（今日ページ）
│   ├── read/
│   │   └── 2026-08-21.html     # 公開日ごとに増えるアーカイブ（1日1ファイル、以後編集しない）
│   ├── write.html
│   ├── write/
│   │   └── 2026-08-21.html
│   ├── debug.html
│   └── debug/
│       └── 2026-08-21.html
├── cpp/                       # 同じパターン（read / read/ / write / write/ / debug / debug/）
├── rust/                      # 同じパターン
├── haskell/                   # 同じパターン
└── doc/
    ├── requirements.md
    └── basic-design.md
```

`read/`・`write/`・`debug/` ディレクトリは、最初のアーカイブが作られるまでは存在しない。1日目にアーカイブを作った時点で生まれる。

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
| `c/read.html` | `/c/read` |
| `c/read/2026-08-21.html` | `/c/read/2026-08-21` |
| `c/write.html` | `/c/write` |
| `c/debug.html` | `/c/debug` |
| `cpp/read.html` | `/cpp/read` |
| `rust/read.html` | `/rust/read` |
| `haskell/read.html` | `/haskell/read` |

（`write` / `debug` および他の3言語も同じパターン。アーカイブは各組み合わせにつき公開日の数だけ増えていく。）

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

見た目は既存のコンポーネント（`.path` / `pre.code` / `.question`）をそのまま流用し、コンパイラのエラー出力ふうに組む。新しいCSSは増やさない。

```html
<main>
  <h2>404</h2>
  <p class="path">/* this page does not exist */</p>

  <pre class="code"><code>error: page not found
 --&gt; the path you followed
  |
  = note: no such route in this crate
</code></pre>

  <p class="question">
    That page doesn't exist. It may have moved, or never did.
  </p>

  <p><a href="/">&larr; Back to Namara</a></p>
</main>
```

`.wrap` を使う（`.page` ではない）。404ページは特定の言語・種別に属さないため、nav も past ペインも持たない。

---

## 7. HTMLページ規約

### 7.1 今日ページ（例: `c/read.html`）

構成要素の順番：

1. header（サイト名・タグライン）
2. language navigation
3. exercise navigation
4. code
5. question
6. details（Answer / Reference）
7. past（過去日へのリンク。まだ1件もなければセクションごと省略する）
8. footer

具体例：

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Namara — C / READ</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div class="page">

<header class="masthead">
  <h1><a href="/">Namara</a></h1>
  <p class="tagline">Code daily. Without assist.</p>
</header>

<nav class="lang-nav" aria-label="Language">
  <a href="/c/read" class="active" aria-current="page">C</a>
  <a href="/cpp/read">C++</a>
  <a href="/rust/read">Rust</a>
  <a href="/haskell/read">Haskell</a>
</nav>

<nav class="type-nav" aria-label="Exercise type">
  <a href="/c/read" class="active" aria-current="page">READ</a>
  <a href="/c/write">WRITE</a>
  <a href="/c/debug">DEBUG</a>
</nav>

<main>
  <h2>Today's code</h2>

  <pre class="code"><code>&lt;!-- ここにコード。&lt; &gt; &amp; は必ずHTMLエスケープする --&gt;
</code></pre>

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
    <li><a href="/c/read/2026-08-20">2026-08-20</a></li>
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

* `<title>` は `Namara — {言語} / {種別}` に統一
* `<html lang="en">` を使う（UI文言・問題文は英語で統一しているため）
* masthead の `<h1>` は `/`（ルートページ）へリンクする。以前の設計では `/c/read` へリンクしていたが、ルートページが実コンテンツを持つようになったため、ロゴのリンク先は常にサイトの入口である `/` に統一する
* リンクはすべて拡張子なし（§5）
* `lang-nav` / `type-nav` は12ページ全てで同一構造。**現在地のリンクにだけ `class="active"` と `aria-current="page"` を手動で付ける**
* WRITEページは `<summary>Answer</summary>` を `<summary>Reference</summary>` に変える（要件定義 §9 WRITEの節）
* コード内の `<` `>` `&` は `&lt;` `&gt;` `&amp;` に置換してから貼る
* `past-list` のリンクは新しい日付が先（降順）。件数の上限は設けない（増えすぎたときの対処はv1のスコープ外。要件定義 §22 の通り、目立たせる場所でもない）
* まだアーカイブが1件もなければ `<aside class="past">` ごと省略する。CSS側が `.past` の有無を検知して1カラムに戻す（§8）ので、HTML側は単に書かないだけでよい

### 7.2 アーカイブページ（例: `c/read/2026-08-21.html`）

今日ページとほぼ同じ構成だが、次の点が異なる。

* `<title>` は `Namara — {言語} / {種別} — {日付}` にする
* `<h2>` は `Today's code` ではなく、その日付そのもの（例: `2026-08-21`）にする。何の問題かは nav・title・path で分かるので、見出しは「いつのものか」を示せば十分
* `.path` の内容にも日付を含める（例: C/C++なら `/* c/read/2026-08-21 */`、Rustなら `// rust/read/2026-08-21`、Haskellなら `-- haskell/read/2026-08-21`）
* `past` の中身は、そのページを公開した時点でのスナップショットにする：先頭に今日ページへの `Today` リンク、続けてそれより古い日付（あれば）。**このリストは公開後、二度と更新しない**（今日ページのPastは常に最新だが、アーカイブページのPastはその日時点の記録のまま固定される。もっと新しい日を見たければ `Today` を辿ればよい）

```html
<main>
  <h2>2026-08-21</h2>
  <p class="path">/* c/read/2026-08-21 */</p>

  <pre class="code"><code>...</code></pre>

  <p class="question">...</p>

  <details class="answer">
    <summary>Answer</summary>
    <p>...</p>
  </details>
</main>

<aside class="past">
  <h2>Past</h2>
  <ul class="past-list">
    <li><a href="/c/read">Today</a></li>
    <li class="current">2026-08-21</li>
  </ul>
</aside>
```

`current` クラスの項目はリンクにしない（自分自身のページなので）。nav の `active` と同じ「ここにいる」表現をここでも使う。

**アーカイブページは公開したら二度と編集しない。** 今日ページ（`c/read.html` など）だけが、次の更新のたびに上書きされ続ける。この非対称性が、アーカイブを「後から壊れない固定記録」にしている。

> **原則：ページ間のHTML重複は意図的に許容する。** 12ページ間の重複（既出）に加えて、今日ページとアーカイブページの内容重複（公開した瞬間は同じ内容になる）も同様に許容する。重複除去のためだけにビルド処理・テンプレートエンジン・JavaScriptを導入しない。

### 7.3 ルートページ（`index.html`）

§6 を参照。他の12ページと同じ `header` / `footer` は流用するが、`nav`（lang-nav / type-nav）は持たない。ルートページ自体はどの言語・種別にも属さないため。

---

## 8. スタイル設計（`style.css`）

優先順位は要件定義 §19 の通り：①コード可読性 → ②問題文可読性 → ③答え可読性 → ④モバイル → ⑤ブランド。

方針だけ決め、細部は実装時に詰める：

* 本文フォント: システムフォントスタック（`-apple-system, "Segoe UI", sans-serif` 等）。外部フォント読み込みはしない（§3.2）
* コードフォント: `ui-monospace, "SFMono-Regular", Consolas, monospace`
* `pre.code`: 横スクロール可（`overflow-x: auto`）、折り返さない、背景をわずかに区別する程度
* ルートページ・404ページ（`.wrap`）は1カラム、`max-width: 640px` 程度の中央寄せコンテナ
* 今日ページ・アーカイブページ（`.page`）は `max-width: 864px` 程度。CSS GridでPastペインを右側に置く。40rem未満の画面では自動的に1カラムへ積み上がる（メディアクエリを1つだけ使う。「PC用CSSとモバイル用CSSを分ける」のではなく、2カラムという構造そのものが狭い画面には物理的に収まらないための、機能上必要な分岐）
* Pastペインが存在しない（アーカイブが1件もない）ページは、CSSの `:has()` で検知して自動的に1カラムへ戻す。HTML側で場合分けを書く必要はない
* アニメーション・トランジションなし
* 色数を絞る（背景1色・文字1色・アクセント1色程度）
* `nav a.active` / `.past-list .current` は色とウェイト変更程度の控えめな強調のみで統一する

ファイル冒頭には最小限のリセットを置く（`box-sizing: border-box`と、実際に使っている要素——`html` / `body` / `h1` / `h2` / `p`——の余白ゼロのみ）。Namaraのページに存在しない要素（画像・table・フォーム・リスト等）のリセットは書かない。将来使うかもしれない要素への予防的なリセットはしない。リセットは汎用部分として先頭にまとめ、Namara固有のトークン適用（背景色・文字色・フォント）はその直後の「Base」セクションに分離する。

`past`（今日ページ）や `guide`（ルートページ）のセクションは、`h2` / `p` / `a` / `strong` の範囲に収まる。新しい要素（画像・リスト・テーブル等）を増やさずに書けるため、追加のリセットは不要。

CSSファイルは1枚のみとし、ページ側の `<link>` は共通で `/style.css` を指す。

---

## 9. コンテンツ運用フロー

```text
1. 問題を1つ作る（言語・種別・code・question・answerを決める）
2. {lang}/{type}/{今日の日付}.html を新規作成する（例: c/read/2026-08-21.html）
   - §7.2の規約に沿って code / question / answer を書く
   - <title>・<h2>・.path の日付を今日の日付にする
   - コードは HTML エスケープする
   - Past ペインは「Today」リンク＋（あれば）それより古い日付のスナップショットにする。このファイルは公開後、二度と編集しない
3. {lang}/{type}.html（今日ページ）を、手順2と同じ内容で上書きする
   - §7.1の規約に沿って書く（<title>・<h2> は「Today's code」のまま、.path は日付なし）
   - Past ペインの先頭に、手順2で作ったページへのリンクを追加する（1件目なら `<aside class="past">` ごと新設する）
4. git commit
5. git push
6. Cloudflare Pages が自動デプロイ
```

手順2で作ったファイルは、以後二度と編集しない。手順3の今日ページだけが、次の更新でまた上書きされる。

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

なお、ここで作らない「履歴」はユーザー個人の解答履歴・進捗であり、問題コンテンツ自体のアーカイブ（§7.2、§9）とは別物である（要件定義 §17、§22）。

---

## 12. 最短で動かすための手順（Definition of Done）

以下が揃えば「動くNamara」として成立する。中身の問題文はプレースホルダーでよく、後から差し替えれば良い。

1. `style.css` を1枚作る（§8の方針で最小限）
2. `index.html` を実コンテンツで作る（§6）
3. `_headers` を作る（§3.3）
4. `404.html` を最小限の内容で作る（§6）
5. §7.1の規約を元に、12ページ（4言語 × 3種別）の「今日ページ」をプレースホルダー内容で作成する
6. §7.2の規約を元に、それぞれに対応する初日のアーカイブページ（例: `c/read/2026-08-21.html`）を作成し、今日ページの Past セクションからリンクする（初日はリンクが1件だけになる）
7. GitHubリポジトリを作成し、上記一式をpush
8. Cloudflare PagesとGitHubリポジトリを接続し、§10の設定でデプロイ
9. `/` を開いて、Namaraの説明文と12個の案内リンクが表示されることを確認する
10. `/c/read` のような今日ページと、`/c/read/2026-08-21` のようなアーカイブページの両方に、`.html` なしで直接アクセスできることを確認する
11. 画面幅が40rem以上のとき、今日ページの右側にPastペインが表示され、日付をクリックするとその日のアーカイブページに切り替わることを確認する（JS不使用、ページ遷移のみ）
12. レスポンスヘッダに `Content-Security-Policy` 等が付与されていることを確認する（ブラウザの開発者ツール／`curl -I`）

ここまでで公開可能。以降の作業は「問題の中身を良くしていくこと」だけになり、それは要件定義 §24 の言う通りNamaraの本質的な資産である。
