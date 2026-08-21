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
* 「今日はRust/READ、明日はC++/FIX」のように、ユーザー自身が対象を選べる方が要件定義 §4 Skill Maintenance の思想に近い
* サイト全体で1つの問題に絞ろうとすると、「言語をどう選ぶか」という新しい決定ロジック（ローテーション、優先度、ランダム等）が必要になり、要件定義 §21 が明確に拒否している複雑さを呼び込む

要件定義 §1 の「1日1問」は、この12ページ構造と矛盾しないよう「1日1問を目安に、自分が維持したい言語・技能の問題へ触れる」という表現に修正済み（`requirements.md` 側を更新した）。

各ページが独立して「Today's code」を名乗ってよい。ページ間で内容の整合性（同じ日に全ページを揃えて更新する、など）を取る必要はない。更新頻度もページごとにバラついてよい。

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

---

## 4. ディレクトリ構成

```text
namara/
├── index.html             # ルート用の最小フォールバック（本文は複製しない。§6参照）
├── style.css               # 全ページ共通スタイル（1枚のみ）
├── _redirects               # Cloudflare Pages のリダイレクト定義
├── _headers                 # Cloudflare Pages のセキュリティヘッダ定義（§3.3）
├── 404.html                 # 任意。ルートにindex.htmlがない場合の404対策と同様の理由で用意してよい
├── c/
│   ├── read.html
│   ├── write.html
│   └── fix.html
├── cpp/
│   ├── read.html
│   ├── write.html
│   └── fix.html
├── rust/
│   ├── read.html
│   ├── write.html
│   └── fix.html
├── haskell/
│   ├── read.html
│   ├── write.html
│   └── fix.html
└── doc/
    ├── requirements.md
    └── basic-design.md
```

---

## 5. URL設計（ファイルパスとURLの対応）

Cloudflare Pagesは `.html` 拡張子付きのURLへアクセスがあった場合、拡張子なしのURLへ自動的にリダイレクトする（[Serving Pages](https://developers.cloudflare.com/pages/configuration/serving-pages/)）。つまり `rust/fix.html` というファイルを置いても、最終的に生きるURLは `/rust/fix` になる。

したがって：

* **ファイルは `.html` 拡張子付きのまま置く**（エディタでの編集しやすさを優先。ファイル名変更は不要）
* **HTML内のリンク（`<a href="...">`）は最初から拡張子なしで書く**。`.html` 付きで書いても最終的にリダイレクトされて動作はするが、無駄な302を毎回踏むことになるため避ける

対応表：

| ファイル | 公開URL |
|---|---|
| `index.html` | `/` |
| `c/read.html` | `/c/read` |
| `c/write.html` | `/c/write` |
| `c/fix.html` | `/c/fix` |
| `cpp/read.html` | `/cpp/read` |
| `cpp/write.html` | `/cpp/write` |
| `cpp/fix.html` | `/cpp/fix` |
| `rust/read.html` | `/rust/read` |
| `rust/write.html` | `/rust/write` |
| `rust/fix.html` | `/rust/fix` |
| `haskell/read.html` | `/haskell/read` |
| `haskell/write.html` | `/haskell/write` |
| `haskell/fix.html` | `/haskell/fix` |

---

## 6. トップページ（`/`）と `404.html` の扱い

要件定義のUIモックアップは「開いた瞬間にコードが見えている」状態を想定している。ピッカー画面を挟まない。

そこで `index.html` を独立コンテンツにはせず、**Cloudflare Pagesの `_redirects` によるリダイレクト**でデフォルト問題（`/c/read`）へ飛ばす。`_redirects` は静的リダイレクトとして処理され、対象パスにファイルが実在していてもリダイレクトが優先される（[Redirects](https://developers.cloudflare.com/pages/configuration/redirects/)）。

```text
# _redirects
/    /c/read    302
```

理由：

* JSのmeta-refreshより確実で、画面のちらつきもない
* `index.html` に本文を複製すると、更新時に2箇所を同期する必要が出て事故る（C/READの内容を書き換えたのに index.html を直し忘れる、など）
* 実体は12ページに一元化され、常に単一の真実になる

デフォルトの組み合わせは「C / READ」とする（要件定義 §8, §9 の記載順に合わせただけの恣意的な選択。後で変えても実装コストはゼロ）。

ただし `_redirects` が何らかの理由で効かない場合や、ルートに `index.html` が存在しないことに起因する404（Cloudflareのトラブルシューティングでも案内されているケース）を避けるため、`index.html` は空にせず最小限のフォールバックを置く。本文は複製しない。

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Namara</title>
</head>
<body>
  <a href="/c/read">Namara</a>
</body>
</html>
```

実運用では `_redirects` が先に効くため、このページはほぼ誰の目にも触れない。

`404.html` も同様に最小限でよい（任意項目。なくても致命的ではないが、Cloudflare側の404ハンドリングを自前のもので上書きできる）。

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Namara — Not Found</title>
</head>
<body>
  <p>ページが見つかりません。</p>
  <a href="/c/read">Namaraへ戻る</a>
</body>
</html>
```

---

## 7. HTMLページ規約

12ページ（4言語 × 3種別）に共通する構成要素の並び順を定義する。テンプレートエンジンは使わないため、これは「実行される仕組み」ではなく、**新しいページを書く／更新するときに人間が守る規約**である。

構成要素の順番：

1. header（サイト名・タグライン）
2. language navigation（言語切り替え）
3. exercise navigation（種別切り替え：READ / WRITE / FIX）
4. code
5. question
6. details（Answer / Reference）
7. footer

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

<header>
  <h1>Namara</h1>
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
  <a href="/c/fix">FIX</a>
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

<footer>
  <p>A daily maintenance routine for programmers.</p>
</footer>

</body>
</html>
```

ルール：

* `<title>` は `Namara — {言語} / {種別}` に統一
* `<html lang="en">` を使う（UI文言・問題文は英語で統一しているため）
* リンクはすべて拡張子なし（§5）
* `lang-nav` / `type-nav` は12ページ全てで同一構造。**現在地のリンクにだけ `class="active"` と `aria-current="page"` を手動で付ける**（静的なので機械的に管理する仕組みはない。コピー時に付け間違えないことが唯一の注意点）
* WRITEページは `<summary>Answer</summary>` を `<summary>Reference</summary>` に変える（要件定義 §9 WRITEの節）
* コード内の `<` `>` `&` は `&lt;` `&gt;` `&amp;` に置換してから貼る（自動エスケープの仕組みがないため人力でやる）

> **原則：12ページ間のHTML重複は意図的に許容する。重複除去のためだけにビルド処理・テンプレートエンジン・JavaScriptを導入しない。**
>
> 12ページ × 数十行程度の重複はDRYにしないほうが正しい。共通化したい欲求が出たら、それはNamaraの規模に対して過剰設計になっていないか疑う。

---

## 8. スタイル設計（`style.css`）

優先順位は要件定義 §19 の通り：①コード可読性 → ②問題文可読性 → ③答え可読性 → ④モバイル → ⑤ブランド。

方針だけ決め、細部は実装時に詰める：

* 本文フォント: システムフォントスタック（`-apple-system, "Segoe UI", sans-serif` 等）。外部フォント読み込みはしない（§3.2）
* コードフォント: `ui-monospace, "SFMono-Regular", Consolas, monospace`
* `pre.code`: 横スクロール可（`overflow-x: auto`）、折り返さない、背景をわずかに区別する程度
* 1カラム、`max-width: 640px` 程度の中央寄せコンテナで、モバイルでもPCでも同じ見え方にする（レスポンシブ用のブレークポイント分岐は不要）
* アニメーション・トランジションなし
* 色数を絞る（背景1色・文字1色・アクセント1色程度）
* `nav a.active` は下線かウェイト変更程度の控えめな強調のみ

CSSファイルは1枚のみとし、ページ側の `<link>` は共通で `/style.css` を指す。

ファイル冒頭には、ブラウザ間の既定スタイル差異を打ち消すための中庸〜やや強めのリセットを置く（`box-sizing: border-box`、見出し/段落/リストの余白ゼロ、`list-style: none`、画像・table・formの既定見た目の除去など）。ただし見出しを見出しとして、リストをリストとして扱う意味（セマンティクス）は削らない。リセットは汎用部分として先頭にまとめ、Namara固有のトークン適用（背景色・文字色・フォント）はその直後の「Base」セクションに分離する。

---

## 9. コンテンツ運用フロー

要件定義 §21 のフローそのものを、具体的な操作に落とすと以下になる。

```text
1. 問題を1つ作る（言語・種別・code・question・answerを決める）
2. 該当する言語/種別のHTMLファイルを開く（例: rust/fix.html）
3. §7の規約に沿って code / question / answer 部分だけを書き換える
   - コードは HTML エスケープする
   - リンクを新たに書く場合は拡張子なし（例: /rust/fix）で書く
   - <title> の 種別 部分がそのページの種別と一致しているか確認する
4. git commit
5. git push
6. Cloudflare Pages が自動デプロイ
```

新しい言語・種別を追加することは v1 の想定に含まれない（要件定義 §8 で4言語固定、§9 で3種別固定）。ページ数が動的に増減しないため、ナビゲーションのリンク一覧を書き換える必要も出ない。

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

要件定義 §22 と一致。設計上ここに迷いを残さない。

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
```

---

## 12. 最短で動かすための手順（Definition of Done）

以下が揃えば「動くNamara」として成立する。中身の問題文はプレースホルダーでよく、後から差し替えれば良い。

1. `style.css` を1枚作る（§8の方針で最小限）
2. `_redirects` を1行作る（§6）
3. `_headers` を作る（§3.3）
4. `index.html` と `404.html` を最小限の内容で作る（§6）
5. §7の規約を元に、12ページ（4言語 × 3種別）をプレースホルダー内容で作成する
6. GitHubリポジトリを作成し、上記一式をpush
7. Cloudflare PagesとGitHubリポジトリを接続し、§10の設定でデプロイ
8. `/` を開いて `/c/read` にリダイレクトされ、コード・問い・折りたたみ式Answerが表示されることを確認する
9. `/rust/fix` のように、いずれかのページに `.html` なしで直接アクセスできることも確認する
10. レスポンスヘッダに `Content-Security-Policy` 等が付与されていることを確認する（ブラウザの開発者ツール／`curl -I`）

ここまでで公開可能。以降の作業は「問題の中身を良くしていくこと」だけになり、それは要件定義 §23 の言う通りNamaraの本質的な資産である。
