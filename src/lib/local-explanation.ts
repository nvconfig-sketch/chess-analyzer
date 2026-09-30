import { CLASSIFICATION_META } from "@/lib/classify";
import type { BilingualExplanation, ExplainRequest } from "@/lib/types";

export function localExplanation(payload: ExplainRequest): BilingualExplanation {
  const meta = CLASSIFICATION_META[payload.classification];
  const best = payload.bestMoveSan ?? payload.bestMove;
  const side = payload.side;
  const hebrewSide = side === "White" ? "לבן" : "שחור";
  const create = (en: ExplanationParts, he: ExplanationParts) =>
    createExplanation(en, he, payload.opening);

  switch (payload.classification) {
    case "blunder":
      return create(
        {
          assessment: `${side} played ${payload.moveSan}, a blunder costing about ${payload.evalDelta}; ${best ? `${best} was stronger.` : "a tactical threat was likely missed."}`,
          goal: "The aim should be to limit the opponent's threats and keep the position defensible.",
          plan: "The move missed a concrete defensive or tactical resource; compare it with the engine choice and identify the vulnerable piece or king.",
          next: "Before pursuing a new plan, check for immediate checks, captures, and threats, then coordinate pieces to repair the weakness.",
        },
        {
          assessment: `${hebrewSide} שיחק ${payload.moveSan}, טעות חמורה שעולה בערך ${payload.evalDelta}; ${best ? `${best} היה חזק יותר.` : "כנראה הוחמץ איום טקטי."}`,
          goal: "המטרה היא לצמצם את איומי היריב ולשמור על עמדה שניתן להגן עליה.",
          plan: "המסע החמיץ משאב הגנתי או טקטי; השוו אותו לבחירת המנוע וזהו את הכלי או את המלך שנותרו חשופים.",
          next: "לפני שמתחילים תוכנית חדשה, בדקו שח, הכאות ואיומים מיידיים, ואז תאמו בין הכלים כדי לתקן את החולשה.",
        },
      );
    case "mistake":
      return create(
        {
          assessment: `${payload.moveSan} is a mistake for ${side}, giving away about ${payload.evalDelta} without losing immediately.`,
          goal: "The player should aim to preserve the position's main strength and reduce the opponent's counterplay.",
          plan: `${best ? `${best} better supports that goal` : "A move improving a piece or stopping the main threat would better support that goal"} than the move played.`,
          next: "Look for a safer improving move first; then prepare a pawn break or piece regrouping that addresses the position's main weakness.",
        },
        {
          assessment: `${payload.moveSan} הוא מסע שגוי של ${hebrewSide}, שמוותר על כ-${payload.evalDelta} בלי להפסיד מיד.`,
          goal: "כדאי לשאוף לשמור על היתרון המרכזי בעמדה ולצמצם את משחק הנגד של היריב.",
          plan: `${best ? `${best} תומך טוב יותר במטרה הזאת` : "מסע שמשפר כלי או עוצר את האיום העיקרי יתמוך טוב יותר במטרה הזאת"} מהמסע ששוחק.`,
          next: "חפשו תחילה מסע משפר ובטוח; לאחר מכן הכינו פריצת רגלי או ארגון מחדש של הכלים שיתמודד עם החולשה המרכזית בעמדה.",
        },
      );
    case "poor":
      return create(
        {
          assessment: `${payload.moveSan} is a poor move for ${side}, losing about ${payload.evalDelta}; compare it with ${best ?? "the engine's best move"}.`,
          goal: "The player needs to contain the opponent's strongest threat and avoid creating new weaknesses.",
          plan: "This choice makes coordination or defense harder; identify the weakness it leaves behind and how a better move would address it.",
          next: "Prioritize defending the exposed target and regrouping the pieces; only then look for a pawn break or active counterplay.",
        },
        {
          assessment: `${payload.moveSan} הוא מסע חלש של ${hebrewSide}, שמפסיד בערך ${payload.evalDelta}; השוו אותו ל-${best ?? "מסע המנוע הטוב ביותר"}.`,
          goal: "כדאי לצמצם את האיום החזק ביותר של היריב ולהימנע מיצירת חולשות חדשות.",
          plan: "הבחירה הזאת מקשה על התיאום או על ההגנה; זהו את החולשה שנותרה וכיצד מסע טוב יותר היה מטפל בה.",
          next: "העדיפו להגן על המטרה החשופה ולארגן מחדש את הכלים; רק לאחר מכן חפשו פריצת רגלי או משחק נגדי פעיל.",
        },
      );
    case "inaccuracy":
      return create(
        {
          assessment: `${payload.moveSan} is playable but imprecise; ${side} gave up about ${payload.evalDelta} compared with the engine line.`,
          goal: "The player should aim to improve the least active piece or put pressure on the opponent's weakest target.",
          plan: `${best ? `${best} is a useful comparison for the more purposeful plan` : "A more purposeful plan would improve coordination or increase pressure"}; the played move may be too slow or leave a piece on a passive square.`,
          next: "Use the next turns to improve that piece or prepare a pawn break before the opponent consolidates.",
        },
        {
          assessment: `${payload.moveSan} הוא מסע אפשרי אך לא מדויק; ${hebrewSide} ויתר על כ-${payload.evalDelta} לעומת וריאציית המנוע.`,
          goal: "כדאי לשאוף לשפר את הכלי הפחות פעיל או להפעיל לחץ על המטרה החלשה ביותר של היריב.",
          plan: `${best ? `${best} הוא נקודת השוואה לתוכנית ממוקדת יותר` : "תוכנית ממוקדת יותר תשפר את התיאום או תגביר את הלחץ"}; ייתכן שהמסע ששוחק איטי מדי או משאיר כלי בעמדה סבילה.`,
          next: "השתמשו במסעים הקרובים לשיפור הכלי הזה או להכנת פריצת רגלי, לפני שהיריב יתבסס.",
        },
      );
    case "brilliant":
      return create(
        {
          assessment: `${payload.moveSan} is a brilliant idea: ${side} found the strongest move in a position where material is being offered or a concrete tactic is involved.`,
          goal: "The aim is to convert the temporary material or positional investment into a lasting initiative or decisive target.",
          plan: "The move coordinates the attack around its deeper tactical point; follow the engine's best line to see how the pieces support one another.",
          next: "Keep the initiative by bringing more pieces toward the target and calculate the opponent's best defense before taking material back.",
        },
        {
          assessment: `${payload.moveSan} הוא רעיון מבריק: ${hebrewSide} מצא את המסע החזק ביותר בעמדה שבה מוותרים על חומר או מעורבת טקטיקה קונקרטית.`,
          goal: "המטרה היא להפוך את ההשקעה הזמנית בחומר או בעמדה ליוזמה מתמשכת או למטרה מכרעת.",
          plan: "המסע מתאם את ההתקפה סביב הרעיון הטקטי העמוק; עקבו אחר וריאציית המנוע כדי לראות כיצד הכלים תומכים זה בזה.",
          next: "שמרו על היוזמה באמצעות קירוב כלים נוספים למטרה, וחשבו על ההגנה הטובה ביותר של היריב לפני החזרת החומר.",
        },
      );
    case "great":
      return create(
        {
          assessment: `${payload.moveSan} is a great find by ${side}, preserving or creating a clear advantage around ${payload.evalAfter}.`,
          goal: "The player is aiming to turn the position's initiative into a lasting advantage rather than let the opponent equalize.",
          plan: "The move creates a concrete problem that limits the opponent's choices; identify the target or weakness that makes this idea work.",
          next: "Keep pressure on that target, improve the supporting pieces, and be ready to open the position while the opponent is tied down.",
        },
        {
          assessment: `${payload.moveSan} הוא מהלך מצוין של ${hebrewSide}, ששומר או יוצר יתרון ברור של בערך ${payload.evalAfter}.`,
          goal: "המטרה היא להפוך את היוזמה בעמדה ליתרון מתמשך, ולא לאפשר ליריב להשוות.",
          plan: "המסע יוצר בעיה קונקרטית שמגבילה את אפשרויות היריב; זהו את המטרה או החולשה שמאפשרת לרעיון לעבוד.",
          next: "המשיכו ללחוץ על אותה מטרה, שפרו את הכלים התומכים והיו מוכנים לפתוח את העמדה כשהיריב מרותק להגנה.",
        },
      );
    case "best":
    case "excellent":
      return create(
        {
          assessment: `${payload.moveSan} matches or nearly matches Stockfish, keeping the evaluation around ${payload.evalAfter}.`,
          goal: "The player is aiming to make the position easier to play by improving activity, king safety, or pressure on a weakness.",
          plan: `This move supports that goal by coordinating the pieces or preserving a useful option; compare it with ${best ?? "the engine's preferred plan"}.`,
          next: "Continue improving the least active piece, then prepare a pawn break or a transfer of pressure toward the opponent's weaker side.",
        },
        {
          assessment: `${payload.moveSan} תואם או כמעט תואם את בחירת Stockfish, ושומר על הערכה של בערך ${payload.evalAfter}.`,
          goal: "המטרה היא להפוך את העמדה לנוחה יותר למשחק באמצעות שיפור הפעילות, בטיחות המלך או לחץ על חולשה.",
          plan: `המסע תומך במטרה הזאת באמצעות תיאום הכלים או שמירה על אפשרות מועילה; השוו אותו ל-${best ?? "התוכנית המועדפת על המנוע"}.`,
          next: "המשיכו לשפר את הכלי הפחות פעיל, ואז הכינו פריצת רגלי או העבירו את הלחץ לעבר האגף החלש של היריב.",
        },
      );
    case "book":
      return create(
        {
          assessment: `${payload.moveSan} is a standard opening move that keeps the position near ${payload.evalAfter}.`,
          goal: "The player is aiming to build a healthy position by contesting the center and creating room for the pieces.",
          plan: "Develop pieces toward useful squares, coordinate them, and secure the king; the move is part of that setup rather than a stand-alone threat.",
          next: "Complete development and castling, then prepare a central pawn break when the pieces are ready.",
        },
        {
          assessment: `${payload.moveSan} הוא מסע פתיחה מקובל ששומר על עמדה מאוזנת, בערך ${payload.evalAfter}.`,
          goal: "המטרה היא לבנות עמדה בריאה באמצעות מאבק על המרכז ויצירת מרחב לכלים.",
          plan: "פתחו כלים למשבצות מועילות, תאמו ביניהם והבטיחו את המלך; המסע הוא חלק מההיערכות הזאת ולא איום בפני עצמו.",
          next: "השלימו את פיתוח הכלים והצריחו, ואז הכינו פריצת רגלי במרכז כשהכלים מוכנים.",
        },
      );
    case "forced":
      return create(
        {
          assessment: `${payload.moveSan} is essentially forced; alternatives allow mate or a major material loss.`,
          goal: "The immediate goal is to neutralize the threat and keep the game going, not to launch a new plan.",
          plan: "This move meets the opponent's forcing idea; identify the threat so the defensive purpose is clear.",
          next: "Once the immediate danger is contained, reorganize the pieces and look for a safe way to regain activity.",
        },
        {
          assessment: `${payload.moveSan} הוא למעשה מסע יחיד; החלופות מאפשרות מט או אובדן חומר רב.`,
          goal: "המטרה המיידית היא לנטרל את האיום ולהמשיך במשחק, ולא להתחיל תוכנית חדשה.",
          plan: "המסע עונה על הרעיון הכופה של היריב; זהו את האיום כדי להבין את מטרת ההגנה.",
          next: "לאחר שהסכנה המיידית חלפה, ארגנו מחדש את הכלים וחפשו דרך בטוחה להחזיר להם פעילות.",
        },
      );
    default:
      return create(
        {
          assessment: `${side} played ${payload.moveSan} (${meta.label}); the evaluation changed from ${payload.evalBefore} to ${payload.evalAfter}.`,
          goal: "Aim to improve the least active piece or create pressure against a concrete weakness.",
          plan: `${best ? `${best} is the engine's reference for a more effective plan` : "Choose a plan that improves coordination and limits counterplay"}; assess what the position makes possible.`,
          next: "Prepare a useful pawn break or piece improvement, and reassess the target after the opponent responds.",
        },
        {
          assessment: `${hebrewSide} שיחק ${payload.moveSan} (${meta.label}); הערכת המנוע השתנתה מ-${payload.evalBefore} ל-${payload.evalAfter}.`,
          goal: "שאפו לשפר את הכלי הפחות פעיל או ליצור לחץ על חולשה ממשית.",
          plan: `${best ? `${best} הוא נקודת הייחוס של המנוע לתוכנית יעילה יותר` : "בחרו תוכנית שמשפרת את התיאום ומצמצמת משחק נגדי"}; בדקו מה העמדה מאפשרת.`,
          next: "הכינו פריצת רגלי מועילה או שיפור של כלי, ובחנו מחדש את המטרה לאחר תגובת היריב.",
        },
      );
  }
}

type ExplanationParts = {
  assessment: string;
  goal: string;
  plan: string;
  next: string;
};

function createExplanation(
  en: ExplanationParts,
  he: ExplanationParts,
  opening: ExplainRequest["opening"],
): BilingualExplanation {
  const englishOpeningNote =
    opening?.status === "in-book" && opening.nameEn
      ? `In theory: ${opening.nameEn}${opening.eco ? ` (${opening.eco})` : ""}. `
      : opening?.status === "out-of-book" && opening.isFirstDeviationMove
        ? `The first move out of theory after ${opening.nameEn ?? "the recorded opening"} is ${opening.deviationMove ?? "this move"}. `
        : "";
  const hebrewOpeningNote =
    opening?.status === "in-book" && opening.nameHe
      ? `בתיאוריה: ${opening.nameHe}${opening.eco ? ` (${opening.eco})` : ""}. `
      : opening?.status === "out-of-book" && opening.isFirstDeviationMove
        ? `המסע הראשון מחוץ לתיאוריה אחרי ${opening.nameHe ?? "הפתיחה המתועדת"} הוא ${opening.deviationMove ?? "המסע הזה"}. `
        : "";

  return {
    en: `Assessment: ${englishOpeningNote}${en.assessment}\nGoal: ${en.goal}\nPlan: ${en.plan}\nNext: ${en.next}`,
    he: `הערכה: ${hebrewOpeningNote}${he.assessment}\nמטרה: ${he.goal}\nתוכנית: ${he.plan}\nהמשך: ${he.next}`,
  };
}
