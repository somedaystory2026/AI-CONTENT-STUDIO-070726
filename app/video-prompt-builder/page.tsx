"use client";

import { useMemo, useState } from "react";
import {
  CAMERA_PROMPTS,
  MOTION_PROMPTS,
  REALISM_PROMPTS,
  CAMERA_DEFECT_PROMPTS,
  LIGHTING_PROMPTS,
  STYLE_PROMPTS,
  OUTPUT_PROMPTS,
  SUBJECT_AGES,
  SUBJECT_NATIONALITIES,
  SUBJECT_GENDERS,
  SUBJECT_HAIR,
  SUBJECT_OUTFITS,
  SUBJECT_EXPRESSIONS,
  MODEL_HINTS,
  type PromptOption,
} from "@/lib/video-prompt-library";

function pickRandom<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}
function pickRandomMany<T>(list: T[], count: number): T[] {
  const shuffled = [...list].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

const PRESETS = [
  {
    label: "카페 브이로그",
    camera: "handheld",
    motions: ["walking", "looks_camera", "smiles_softly", "hair_wind"],
    realism: ["authentic", "everyday", "candid"],
    defects: ["handheld_shake", "af_hunting"],
    lighting: "soft_daylight",
    style: "iphone_vlog",
    outputs: ["ratio_916", "dur_15", "smooth_motion"],
  },
  {
    label: "스트릿 캐주얼",
    camera: "tracking",
    motions: ["walking", "jacket_react", "head_turn", "arm_sway"],
    realism: ["natural", "raw", "unposed"],
    defects: ["rolling_shutter", "micro_jitter"],
    lighting: "golden_hour",
    style: "cinematic",
    outputs: ["res_4k", "ratio_169", "dur_30", "high_realism"],
  },
  {
    label: "럭셔리 커머셜",
    camera: "orbit",
    motions: ["looks_camera", "smiles_softly", "adjust_clothing"],
    realism: ["authentic", "real_skin"],
    defects: ["grain"],
    lighting: "rim_light",
    style: "commercial",
    outputs: ["res_4k", "ratio_169", "high_realism", "no_watermark"],
  },
];

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
        active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
      }`}
    >
      {children}
    </button>
  );
}

function CategorySection({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export default function VideoPromptBuilderPage() {
  const [camera, setCamera] = useState("handheld");
  const [motions, setMotions] = useState<string[]>(["walking", "looks_camera", "breathing"]);
  const [realism, setRealism] = useState<string[]>(["authentic", "natural"]);
  const [defects, setDefects] = useState<string[]>(["handheld_shake"]);
  const [lighting, setLighting] = useState("soft_daylight");
  const [style, setStyle] = useState("cinematic");
  const [age, setAge] = useState("mid20s");
  const [nationality, setNationality] = useState("korean");
  const [gender, setGender] = useState("woman");
  const [hair, setHair] = useState("black_ponytail");
  const [outfit, setOutfit] = useState("grey_hoodie");
  const [expression, setExpression] = useState("minimal_makeup");
  const [outputs, setOutputs] = useState<string[]>(["ratio_916", "dur_15", "smooth_motion"]);
  const [modelHint, setModelHint] = useState("generic");
  const [copied, setCopied] = useState(false);

  const toggle = (list: string[], id: string, setter: (v: string[]) => void) => {
    setter(list.includes(id) ? list.filter((v) => v !== id) : [...list, id]);
  };

  const findDetail = (options: PromptOption[], id: string) => options.find((o) => o.id === id)?.detail || "";
  const findDetails = (options: PromptOption[], ids: string[]) => ids.map((id) => findDetail(options, id)).filter(Boolean);

  const finalPrompt = useMemo(() => {
    const hint = MODEL_HINTS.find((m) => m.id === modelHint)?.hint || "";
    const ageDetail = findDetail(SUBJECT_AGES, age);
    const nationalityDetail = findDetail(SUBJECT_NATIONALITIES, nationality);
    const genderDetail = findDetail(SUBJECT_GENDERS, gender);
    const hairDetail = findDetail(SUBJECT_HAIR, hair);
    const outfitDetail = findDetail(SUBJECT_OUTFITS, outfit);
    const expressionDetail = findDetail(SUBJECT_EXPRESSIONS, expression);
    const subjectLine = [ageDetail, nationalityDetail, genderDetail].filter(Boolean).join(" ");

    const lines = [
      `${hint}${subjectLine}, ${hairDetail}, ${outfitDetail}, ${expressionDetail}.`,
      `${findDetail(CAMERA_PROMPTS, camera)}.`,
      findDetails(MOTION_PROMPTS, motions).join(", ") + ".",
      findDetails(REALISM_PROMPTS, realism).join(", ") + ".",
      findDetails(CAMERA_DEFECT_PROMPTS, defects).join(", ") + ".",
      `${findDetail(LIGHTING_PROMPTS, lighting)}.`,
      `${findDetail(STYLE_PROMPTS, style)} style.`,
      findDetails(OUTPUT_PROMPTS, outputs).join(", ") + ".",
    ];

    return lines.filter((line) => line.trim() !== "." && line.trim() !== "").join("\n");
  }, [camera, motions, realism, defects, lighting, style, age, nationality, gender, hair, outfit, expression, outputs, modelHint]);

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setCamera(preset.camera);
    setMotions(preset.motions);
    setRealism(preset.realism);
    setDefects(preset.defects);
    setLighting(preset.lighting);
    setStyle(preset.style);
    setOutputs(preset.outputs);
  };

  const randomizeAll = () => {
    setCamera(pickRandom(CAMERA_PROMPTS).id);
    setMotions(pickRandomMany(MOTION_PROMPTS, 4).map((o) => o.id));
    setRealism(pickRandomMany(REALISM_PROMPTS, 3).map((o) => o.id));
    setDefects(pickRandomMany(CAMERA_DEFECT_PROMPTS, 2).map((o) => o.id));
    setLighting(pickRandom(LIGHTING_PROMPTS).id);
    setStyle(pickRandom(STYLE_PROMPTS).id);
    setOutputs(pickRandomMany(OUTPUT_PROMPTS, 4).map((o) => o.id));
  };

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(finalPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-950">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-indigo-600">AI 영상 프롬프트 빌더</p>
          <h1 className="mt-1 text-4xl font-black tracking-tight">조합형 프롬프트 빌더</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            카메라 · 모션 · 리얼리즘 · 카메라 결함 · 조명 · 스타일 · 피사체 · 출력, 8개 카테고리를 조합해서 Seedance, Veo 3, Kling, Hailuo, Krea 2에 바로 쓸 수 있는 영상 프롬프트를 만듭니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={randomizeAll} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold hover:bg-slate-100">
            🎲 전체 랜덤 조합
          </button>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            onClick={() => applyPreset(preset)}
            className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100"
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <CategorySection title="1. 피사체 (Subject)" hint="나이 · 국적 · 성별 · 헤어 · 착장 · 표정 순으로 조합됩니다">
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3">
              <select value={age} onChange={(e) => setAge(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {SUBJECT_AGES.map((o) => <option key={o.id} value={o.id}>{o.ko}</option>)}
              </select>
              <select value={nationality} onChange={(e) => setNationality(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {SUBJECT_NATIONALITIES.map((o) => <option key={o.id} value={o.id}>{o.ko}</option>)}
              </select>
              <select value={gender} onChange={(e) => setGender(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {SUBJECT_GENDERS.map((o) => <option key={o.id} value={o.id}>{o.ko}</option>)}
              </select>
              <select value={hair} onChange={(e) => setHair(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {SUBJECT_HAIR.map((o) => <option key={o.id} value={o.id}>{o.ko}</option>)}
              </select>
              <select value={outfit} onChange={(e) => setOutfit(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {SUBJECT_OUTFITS.map((o) => <option key={o.id} value={o.id}>{o.ko}</option>)}
              </select>
              <select value={expression} onChange={(e) => setExpression(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
                {SUBJECT_EXPRESSIONS.map((o) => <option key={o.id} value={o.id}>{o.ko}</option>)}
              </select>
            </div>
          </CategorySection>

          <CategorySection title="2. 카메라 (Camera)" hint="1개 선택">
            {CAMERA_PROMPTS.map((o) => (
              <Chip key={o.id} active={camera === o.id} onClick={() => setCamera(o.id)}>{o.ko}</Chip>
            ))}
          </CategorySection>

          <CategorySection title="3. 모션 (Motion)" hint="여러 개 선택 가능">
            {MOTION_PROMPTS.map((o) => (
              <Chip key={o.id} active={motions.includes(o.id)} onClick={() => toggle(motions, o.id, setMotions)}>{o.ko}</Chip>
            ))}
          </CategorySection>

          <CategorySection title="4. 리얼리즘 (Realism)" hint="여러 개 선택 가능">
            {REALISM_PROMPTS.map((o) => (
              <Chip key={o.id} active={realism.includes(o.id)} onClick={() => toggle(realism, o.id, setRealism)}>{o.ko}</Chip>
            ))}
          </CategorySection>

          <CategorySection title="5. 카메라 결함 (Camera Defects)" hint="너무 완벽하면 AI 티가 나서, 일부러 손떨림 등을 섞어줍니다">
            {CAMERA_DEFECT_PROMPTS.map((o) => (
              <Chip key={o.id} active={defects.includes(o.id)} onClick={() => toggle(defects, o.id, setDefects)}>{o.ko}</Chip>
            ))}
          </CategorySection>

          <CategorySection title="6. 조명 (Lighting)" hint="1개 선택">
            {LIGHTING_PROMPTS.map((o) => (
              <Chip key={o.id} active={lighting === o.id} onClick={() => setLighting(o.id)}>{o.ko}</Chip>
            ))}
          </CategorySection>

          <CategorySection title="7. 스타일 (Style)" hint="1개 선택">
            {STYLE_PROMPTS.map((o) => (
              <Chip key={o.id} active={style === o.id} onClick={() => setStyle(o.id)}>{o.ko}</Chip>
            ))}
          </CategorySection>

          <CategorySection title="8. 출력 (Output)" hint="여러 개 선택 가능">
            {OUTPUT_PROMPTS.map((o) => (
              <Chip key={o.id} active={outputs.includes(o.id)} onClick={() => toggle(outputs, o.id, setOutputs)}>{o.ko}</Chip>
            ))}
          </CategorySection>
        </div>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <label className="mb-2 block text-xs font-bold text-slate-500">영상 생성 모델</label>
            <select value={modelHint} onChange={(e) => setModelHint(e.target.value)} className="mb-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {MODEL_HINTS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>

            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-black">완성된 프롬프트</h3>
              <button onClick={copyPrompt} className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800">
                {copied ? "복사됨!" : "복사"}
              </button>
            </div>
            <textarea
              readOnly
              value={finalPrompt}
              className="h-80 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6"
            />
            <p className="mt-3 text-xs leading-5 text-slate-400">
              Seedance, Veo 3, Kling, Hailuo, Krea 2에 그대로 붙여넣을 수 있어요. 모델을 바꾸면 앞에 짧은 안내 문구만 살짝 달라집니다.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
