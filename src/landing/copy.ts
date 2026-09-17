export type Locale = "en" | "ko" | "ja";

export const localeLabels: Record<Locale, string> = {
  en: "EN",
  ko: "KO",
  ja: "JA",
};

export const landingCopy: Record<Locale, {
  nav: string[];
  ctaPrimary: string;
  ctaSecondary: string;
  heroTitle: string;
  heroText: string;
  proof: string[];
  rolesTitle: string;
  roles: Array<{ name: string; role: string; text: string }>;
  flowTitle: string;
  flow: string[];
  boundaryTitle: string;
  boundary: string;
}> = {
  en: {
    nav: ["Characters", "Runtime", "Playground"],
    ctaPrimary: "Preview the cast",
    ctaSecondary: "Download engine kit",
    heroTitle: "One AI task. A stable inner cast. A decision that stays yours.",
    heroText:
      "Define named character agents once, then run them inside the AI tool you already use. The cast deliberates from distinct perspectives; the root or main agent weighs the voices and makes the final call.",
    proof: ["Codex native", "Claude Code native", "Gemini CLI native", "Generic fallback"],
    rolesTitle: "The cast and its decision owner",
    roles: [
      { name: "Doubt", role: "Skeptic", text: "Challenges assumptions, risks, and the urge to rush." },
      { name: "Spark", role: "Advocate", text: "Protects the strongest possibility worth pursuing." },
      { name: "Forge", role: "Builder", text: "Turns the surviving direction into an executable next move." },
      { name: "Root", role: "Decision owner", text: "Synthesizes the tension, accepts the risk, and makes the final call." },
    ],
    flowTitle: "The same cast, adapted to each runtime.",
    flow: ["Define or install the cast once.", "Invoke its characters inside the current AI task.", "Let the root or main agent synthesize and continue the work."],
    boundaryTitle: "An engine, not a separate room",
    boundary:
      "Innercast uses native named agents where the host supports them and an explicit prompt fallback elsewhere. Host capabilities differ, so fallback mode cannot promise the same UI identity or parallelism as native agents.",
  },
  ko: {
    nav: ["캐릭터", "런타임", "플레이그라운드"],
    ctaPrimary: "캐스트 미리보기",
    ctaSecondary: "엔진 키트 다운로드",
    heroTitle: "하나의 AI 작업, 익숙한 내면 캐스트, 그리고 내가 내리는 결정.",
    heroText:
      "이름과 성격이 고정된 캐릭터 에이전트를 한 번 정의하고, 이미 사용하는 AI 안에서 실행합니다. 캐스트는 서로 다른 관점으로 숙의하고, 루트 또는 메인 에이전트가 의견을 종합해 최종 결정을 내립니다.",
    proof: ["Codex 네이티브", "Claude Code 네이티브", "Gemini CLI 네이티브", "범용 폴백"],
    rolesTitle: "기본 캐스트와 결정 주체",
    roles: [
      { name: "Doubt", role: "Skeptic", text: "가정과 위험, 서두르려는 충동을 의심합니다." },
      { name: "Spark", role: "Advocate", text: "계속 살려볼 가장 강한 가능성을 지킵니다." },
      { name: "Forge", role: "Builder", text: "살아남은 방향을 실행 가능한 다음 행동으로 만듭니다." },
      { name: "Root", role: "Decision owner", text: "긴장을 종합하고 감수할 위험을 밝힌 뒤 최종 결정을 내립니다." },
    ],
    flowTitle: "같은 캐스트를 각 AI 런타임에 맞게 적용합니다.",
    flow: ["캐스트를 한 번 정의하거나 설치합니다.", "현재 AI 작업 안에서 캐릭터들을 호출합니다.", "루트 또는 메인 에이전트가 종합하고 작업을 이어갑니다."],
    boundaryTitle: "별도의 대화방이 아니라 내부 엔진입니다",
    boundary:
      "호스트가 지원하면 네이티브 이름형 에이전트를 사용하고, 그렇지 않으면 폴백 프롬프트임을 명시합니다. 호스트 기능이 다르므로 폴백은 네이티브와 같은 UI 정체성이나 병렬 실행을 보장하지 않습니다.",
  },
  ja: {
    nav: ["キャラクター", "ランタイム", "プレイグラウンド"],
    ctaPrimary: "キャストをプレビュー",
    ctaSecondary: "エンジンキットをダウンロード",
    heroTitle: "ひとつのAIタスク、馴染みの内なるキャスト、そして自分の決定。",
    heroText:
      "名前と性格を持つキャラクターエージェントを一度定義し、普段使うAIの中で動かします。キャストが異なる視点で議論し、ルートまたはメインエージェントが意見を統合して最終決定します。",
    proof: ["Codex native", "Claude Code native", "Gemini CLI native", "Generic fallback"],
    rolesTitle: "デフォルトキャストと決定者",
    roles: [
      { name: "Doubt", role: "Skeptic", text: "前提、リスク、急ぐ衝動を疑います。" },
      { name: "Spark", role: "Advocate", text: "追う価値のある最も強い可能性を守ります。" },
      { name: "Forge", role: "Builder", text: "残った方向を実行可能な次の一手にします。" },
      { name: "Root", role: "Decision owner", text: "対立を統合し、受け入れるリスクを示して最終決定します。" },
    ],
    flowTitle: "同じキャストを各AIランタイムへ適応します。",
    flow: ["キャストを一度定義またはインストールする。", "現在のAIタスク内でキャラクターを呼び出す。", "ルートまたはメインエージェントが統合して作業を続ける。"],
    boundaryTitle: "別の会話サービスではなく、内部エンジンです",
    boundary:
      "ホストが対応する場合はネイティブの名前付きエージェントを使い、それ以外ではプロンプトフォールバックであることを明示します。フォールバックはネイティブと同じUI上の人格表示や並列実行を保証しません。",
  },
};
