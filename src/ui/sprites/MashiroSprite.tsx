/**
 * 茉白の立ち絵（SVG製）。
 *
 * AI生成の実素材が入るまでの本番相当プレースホルダ。SVGなので0円・軽量で、
 * 表情差分をコードで持てる。実素材に差し替えるときは sprites/index.ts の
 * 登録先を画像コンポーネントに変えるだけでよい。
 *
 * 設計書 §2.2 の確定事項:
 *   髪色 = **白（白銀。わずかに青みを含む）** / 低い位置のミディアムポニーテール・毛先ハネ気味
 *   24歳・事務職 / ツンデレ。口が悪く、素直に褒めない
 *   終盤に「髪をほどいた」差分を1枚だけ用意する想定（デレ段階の視覚表現）
 *
 * 白は「色が無い」のではなく「五色すべてが重なった光」という位置づけ（CLAUDE.md §3.1）。
 * 主人公・色葉の灰（何も持っていない無彩色）と対になるよう、青みを少しだけ含ませる。
 * ブラウスも白いので、**髪とブラウスの明度を必ず離すこと**（離さないと輪郭が消える）。
 */

export type Expression = 'normal' | 'bored' | 'smug' | 'laugh' | 'fluster' | 'away' | 'smile';

const C = {
  hair: '#DFE5EF',
  hairDark: '#A7B0C0',
  hairLight: '#F4F7FC',
  skin: '#F6DACA',
  skinShade: '#E9BFA9',
  // 髪より一段暗くして、白髪の輪郭が服に溶けないようにする
  blouse: '#D8DCE4',
  blouseShade: '#B9C0CC',
  cardigan: '#4E525E',
  line: '#3A3C46',
  iris: '#5C6A7E',
  irisLight: '#8FA0B4',
  blush: '#EE8497',
  mouth: '#A8626C',
};

interface Props {
  expression?: Expression;
  /** 髪をほどいた差分（終盤のデレ表現用）。今は未使用だが構造だけ用意しておく。 */
  hairDown?: boolean;
}

export default function MashiroSprite({ expression = 'normal', hairDown = false }: Props) {
  const closedEyes = expression === 'laugh' || expression === 'smile';
  const narrowEyes = expression === 'bored' || expression === 'smug';
  const wideEyes = expression === 'fluster';
  /** 目線を横に逃がす量 */
  const gaze = expression === 'away' ? 5 : 0;
  const showBlush = expression === 'fluster';

  return (
    <svg viewBox="0 0 300 460" width="100%" height="100%" role="img" aria-label={`茉白（${expression}）`}>
      {/* ---- 後ろ髪 ---- */}
      <path
        d="M150 26 C86 26 54 76 54 138 C54 186 48 228 38 264 L112 256 C102 216 102 176 108 150 L192 150 C198 176 198 216 188 256 L262 264 C252 228 246 186 246 138 C246 76 214 26 150 26 Z"
        fill={C.hairDark}
      />

      {/* ---- ポニーテール（低い位置・毛先ハネ気味） ---- */}
      {!hairDown && (
        <g>
          <path
            d="M104 206 C80 216 62 250 58 288 C55 322 62 352 74 372 C80 358 84 346 86 334 C90 352 97 366 106 376 C110 358 110 342 108 328 C117 340 126 348 136 352 C122 328 113 300 111 272 C109 244 110 220 118 206 Z"
            fill={C.hair}
          />
          <path
            d="M108 214 C92 228 82 256 80 286 C78 312 82 336 90 354 C92 336 94 320 98 306 C100 328 104 344 110 358 C112 338 112 320 110 304 Z"
            fill={C.hairDark}
            opacity="0.45"
          />
          {/* 髪ゴム */}
          <ellipse cx="112" cy="206" rx="15" ry="8" transform="rotate(-18 112 206)" fill={C.cardigan} />
        </g>
      )}

      {/* ---- 上半身（ブラウス＋カーディガン。事務職らしいきちんと感） ---- */}
      <g>
        <path
          d="M150 250 C112 250 82 268 70 302 C60 332 54 386 50 460 L250 460 C246 386 240 332 230 302 C218 268 188 250 150 250 Z"
          fill={C.blouse}
        />
        <path
          d="M150 250 C112 250 82 268 70 302 C62 326 57 366 53 414 L84 414 C88 356 96 314 108 288 C118 266 132 254 150 250 Z"
          fill={C.blouseShade}
          opacity="0.55"
        />
        {/* カーディガンの前身頃 */}
        <path d="M104 258 C86 268 74 284 68 304 C58 336 53 390 50 460 L96 460 C96 372 100 306 112 262 Z" fill={C.cardigan} />
        <path d="M196 258 C214 268 226 284 232 304 C242 336 247 390 250 460 L204 460 C204 372 200 306 188 262 Z" fill={C.cardigan} />
        {/* 襟元 */}
        <path d="M124 252 L150 300 L176 252 L164 246 L150 274 L136 246 Z" fill={C.blouseShade} />
      </g>

      {/* ---- 首 ---- */}
      <path d="M126 196 L126 244 C126 258 174 258 174 244 L174 196 Z" fill={C.skin} />
      <path d="M126 196 L126 228 C138 240 162 240 174 228 L174 196 Z" fill={C.skinShade} />

      {/* ---- 顔 ---- */}
      <path
        d="M150 218 C119 218 88 184 84 140 C80 96 106 54 150 54 C194 54 220 96 216 140 C212 184 181 218 150 218 Z"
        fill={C.skin}
      />

      {/* 耳 */}
      <ellipse cx="86" cy="140" rx="9" ry="14" fill={C.skin} />
      <ellipse cx="214" cy="140" rx="9" ry="14" fill={C.skin} />

      {/* ---- 頬の赤み ---- */}
      {showBlush && (
        <g opacity="0.5">
          <ellipse cx="110" cy="160" rx="18" ry="9" fill={C.blush} />
          <ellipse cx="190" cy="160" rx="18" ry="9" fill={C.blush} />
        </g>
      )}

      {/* ---- 眉 ---- */}
      <Brows expression={expression} />

      {/* ---- 目 ---- */}
      {closedEyes ? (
        <g stroke={C.line} strokeWidth="4" strokeLinecap="round" fill="none">
          <path d="M104 140 C112 130 130 130 138 140" />
          <path d="M162 140 C170 130 188 130 196 140" />
        </g>
      ) : (
        <>
          <Eye cx={121} cy={141} narrow={narrowEyes} wide={wideEyes} gaze={gaze} />
          <Eye cx={179} cy={141} narrow={narrowEyes} wide={wideEyes} gaze={gaze} />
        </>
      )}

      {/* ---- 口 ---- */}
      <Mouth expression={expression} />

      {/* ---- 前髪（顔の上に重ねる） ---- */}
      <g>
        <path
          d="M150 36 C98 36 70 78 74 128 C82 106 92 90 106 80 C102 98 103 112 108 126 C116 104 128 88 142 80 C139 98 142 112 149 124 C156 106 166 90 179 80 C178 98 182 112 190 128 C197 106 206 92 218 82 C226 100 228 114 226 132 C232 82 202 36 150 36 Z"
          fill={C.hair}
        />
        {/* 髪の艶 */}
        <path d="M112 62 C132 48 168 48 188 62 C168 56 132 56 112 62 Z" fill={C.hairLight} opacity="0.75" />
        {/* 横に落ちる毛束 */}
        <path d="M78 106 C70 140 70 178 78 210 L94 206 C88 176 88 140 92 112 Z" fill={C.hair} />
        <path d="M222 106 C230 140 230 178 222 210 L206 206 C212 176 212 140 208 112 Z" fill={C.hair} />
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------

function Eye({
  cx,
  cy,
  narrow,
  wide,
  gaze,
}: {
  cx: number;
  cy: number;
  narrow: boolean;
  wide: boolean;
  gaze: number;
}) {
  const rx = 13;
  const ry = wide ? 15 : narrow ? 7 : 12;
  const irisR = wide ? 8 : 7.5;

  return (
    <g>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#FFFFFF" />
      <clipPath id={`eyeclip-${cx}`}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} />
      </clipPath>
      <g clipPath={`url(#eyeclip-${cx})`}>
        <circle cx={cx + gaze} cy={cy} r={irisR} fill={C.iris} />
        <circle cx={cx + gaze} cy={cy + 2.5} r={irisR * 0.55} fill={C.irisLight} />
        <circle cx={cx + gaze - 2.6} cy={cy - 3.4} r={2.6} fill="#FFFFFF" />
      </g>
      {/* 上まぶた。細めのときは深く下ろしてジト目にする */}
      <path
        d={`M${cx - rx} ${cy} C${cx - rx + 2} ${cy - ry - 2} ${cx + rx - 2} ${cy - ry - 2} ${cx + rx} ${cy}`}
        fill="none"
        stroke={C.line}
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </g>
  );
}

function Brows({ expression }: { expression: Expression }) {
  const style = { stroke: C.hairDark, strokeWidth: 4.5, strokeLinecap: 'round' as const, fill: 'none' };

  switch (expression) {
    case 'bored': // ジト目。眉尻を下げる
      return (
        <g {...style}>
          <path d="M106 116 L138 122" />
          <path d="M194 116 L162 122" />
        </g>
      );
    case 'smug': // 片眉だけ上げる
      return (
        <g {...style}>
          <path d="M106 118 L138 112" />
          <path d="M194 108 L162 116" />
        </g>
      );
    case 'fluster':
      return (
        <g {...style}>
          <path d="M106 112 C118 104 130 104 138 110" />
          <path d="M194 112 C182 104 170 104 162 110" />
        </g>
      );
    case 'away':
      return (
        <g {...style}>
          <path d="M106 114 L138 116" />
          <path d="M194 112 L162 118" />
        </g>
      );
    default:
      return (
        <g {...style}>
          <path d="M106 116 C118 110 130 110 138 114" />
          <path d="M194 116 C182 110 170 110 162 114" />
        </g>
      );
  }
}

function Mouth({ expression }: { expression: Expression }) {
  switch (expression) {
    case 'laugh':
      return (
        <g>
          <path d="M134 174 C142 190 158 190 166 174 C158 180 142 180 134 174 Z" fill={C.mouth} />
          <path d="M134 174 C142 192 158 192 166 174" fill={C.mouth} />
        </g>
      );
    case 'smile':
      return <path d="M138 176 C145 183 155 183 162 176" fill="none" stroke={C.mouth} strokeWidth="3.4" strokeLinecap="round" />;
    case 'smug':
      return <path d="M136 178 C144 184 156 180 164 172" fill="none" stroke={C.mouth} strokeWidth="3.4" strokeLinecap="round" />;
    case 'bored':
      return <path d="M138 178 L162 178" fill="none" stroke={C.mouth} strokeWidth="3.4" strokeLinecap="round" />;
    case 'fluster':
      return <ellipse cx="150" cy="179" rx="8" ry="9" fill={C.mouth} />;
    case 'away':
      return <path d="M138 180 C146 174 154 178 160 174" fill="none" stroke={C.mouth} strokeWidth="3.2" strokeLinecap="round" />;
    default:
      return <path d="M141 177 C146 181 154 181 159 177" fill="none" stroke={C.mouth} strokeWidth="3.2" strokeLinecap="round" />;
  }
}
