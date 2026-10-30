import type { SupportedLanguage } from "./i18n";
const ids = [
  "first_synapse",
  "gradient_master",
  "quarantine_hero",
  "epoch_survivor",
  "zero_loss",
  "dda_overdrive",
  "weight_tuner",
  "quantum_surge",
];
const text: Record<Exclude<SupportedLanguage, "en">, [string, string][]> = {
  es: [
    ["Primera luz", "Guía 10 señales correctamente."],
    ["En el ritmo", "Consigue 10 aciertos consecutivos."],
    ["Cortafuegos", "Aísla 5 señales corruptas."],
    ["Concentración profunda", "Completa 5 oleadas en una partida."],
    ["Casi perfecto", "Termina con 95% de precisión y al menos 10 señales."],
    ["Más allá del límite", "Alcanza una dificultad de 2,0×."],
    ["Arquitecto", "Cambia las rutas de los relés 20 veces."],
    ["Domador del tiempo", "Activa el modo concentración."],
  ],
  de: [
    ["Erstes Licht", "Leite 10 Signale richtig."],
    ["Im Flow", "Erreiche 10 richtige Signale in Folge."],
    ["Firewall", "Isoliere 5 beschädigte Signale."],
    ["Tiefer Fokus", "Schließe 5 Wellen in einer Runde ab."],
    [
      "Fast perfekt",
      "Beende eine Runde mit 95% Genauigkeit und mindestens 10 Signalen.",
    ],
    ["Über das Limit", "Erreiche Schwierigkeit 2,0×."],
    ["Architekt", "Ändere Relaisrouten 20-mal."],
    ["Zeitbeuger", "Aktiviere den Fokusmodus."],
  ],
  fr: [
    ["Première lumière", "Guidez 10 signaux correctement."],
    ["Dans le rythme", "Réussissez 10 signaux consécutifs."],
    ["Pare-feu", "Isolez 5 signaux corrompus."],
    ["Concentration profonde", "Terminez 5 vagues dans une partie."],
    [
      "Presque parfait",
      "Terminez avec 95% de précision et au moins 10 signaux.",
    ],
    ["Au-delà des limites", "Atteignez une difficulté de 2,0×."],
    ["Architecte", "Changez les routes des relais 20 fois."],
    ["Maître du temps", "Activez le mode concentration."],
  ],
  ja: [
    ["最初の光", "10個の信号を正しく送る。"],
    ["フローの中へ", "10回連続で正しく送る。"],
    ["ファイアウォール", "5個の破損信号を隔離する。"],
    ["深い集中", "1回のプレイで5ウェーブを完了する。"],
    ["ほぼ完璧", "10個以上の信号で正解率95%以上を達成する。"],
    ["限界の先へ", "難易度2.0倍に到達する。"],
    ["設計者", "リレーのルートを20回変更する。"],
    ["時間を操る者", "フォーカスモードを発動する。"],
  ],
  zh: [
    ["第一缕光", "正确引导10个信号。"],
    ["进入状态", "连续正确引导10个信号。"],
    ["防火墙", "隔离5个损坏信号。"],
    ["深度专注", "单局完成5个波次。"],
    ["接近完美", "完成至少10个信号且准确率达到95%。"],
    ["超越极限", "达到2.0倍难度。"],
    ["架构师", "更改中继路由20次。"],
    ["时间掌控者", "激活专注模式。"],
  ],
  ko: [
    ["첫 번째 빛", "10개 신호를 올바르게 보내세요."],
    ["흐름 속으로", "10회 연속으로 성공하세요."],
    ["방화벽", "손상된 신호 5개를 격리하세요."],
    ["깊은 집중", "한 게임에서 5개 웨이브를 완료하세요."],
    ["거의 완벽", "신호 10개 이상에서 정확도 95%를 달성하세요."],
    ["한계 너머", "난이도 2.0배에 도달하세요."],
    ["설계자", "릴레이 경로를 20번 변경하세요."],
    ["시간 지배자", "집중 모드를 활성화하세요."],
  ],
};
export function achievementCopy(
  language: SupportedLanguage,
  achievement: { id: string; name: string; description?: string },
) {
  if (language === "en") return achievement;
  const translated = text[language][ids.indexOf(achievement.id)];
  return translated
    ? { ...achievement, name: translated[0], description: translated[1] }
    : achievement;
}
