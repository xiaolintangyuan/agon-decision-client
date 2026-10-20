import type { ChoiceOption, QType, Question } from "./types";
import { slug } from "./api";

export const uid = () => Math.random().toString(36).slice(2, 10);

function blankOption(): ChoiceOption {
    return { id: uid(), key: "", label: "" };
}

export function newQuestion(type: QType = "noul", name = "", instructions = ""): Question {
    return {
        id: uid(),
        name,
        type,
        instructions,
        options: type === "choice" ? [blankOption(), blankOption(), blankOption()] : [],
        levels: type === "score" ? ["low", "medium", "high"] : [],
    };
}

function describeQuestion(question: Question): string {
    const key = slug(question.name, "q");
    if (question.type === "choice") {
        const optionKeys = question.options
            .map((option) => option.key)
            .filter((optionKey) => optionKey !== "")
            .join(", ");
        return `${key} ∈ {${optionKeys}}`;
    }
    if (question.type === "score") {
        return `${key} ∈ 0..${Math.max(0, question.levels.length - 1)}`;
    }
    return `${key} ∈ {true,false}`;
}

export function buildPreview(questions: Question[], state: string): string {
    const typedQuestions = questions.filter((question) => question.type !== "text");
    if (typedQuestions.length > 0) {
        return typedQuestions.map(describeQuestion).join("   ");
    }
    const instructions = questions[0]?.instructions ?? "";
    if (instructions !== "") {
        return `→ ${instructions}`;
    }
    if (state !== "") {
        return `→ ${state}`;
    }
    return "→ …";
}
