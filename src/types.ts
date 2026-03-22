import type { DoseCalculationResult } from './types/medication.types';

// ============= PATIENTS MODULE TYPES =============
// Basic patient information ONLY - no vaccination logic

export interface ChildProfile {
  id?: number;
  name: string;
  surname: string;
  patronymic?: string;
  birthDate: string; // ISO string YYYY-MM-DD
  gender: 'male' | 'female';
}

export interface PatientAllergy {
  id?: number;
  childId: number;
  substance: string;
  reaction?: string | null;
  severity?: 'mild' | 'moderate' | 'severe' | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ============= VACCINATION MODULE TYPES =============
// Vaccination-specific data ONLY

// Hepatitis B Risk Factor Categories (per Order № 1122н)
export enum HepBRiskFactor {
  MOTHER_HBSAG = 'hepB-mother-hbsag',           // Mother is HBsAg carrier
  MOTHER_SICK = 'hepB-mother-sick',             // Mother has acute/chronic Hepatitis B
  MOTHER_3RD_TRIMESTER = 'hepB-mother-3rd-tri', // Mother had HepB in 3rd trimester
  MOTHER_NO_TEST = 'hepB-mother-no-test',       // No maternal screening results
  MOTHER_DRUGS = 'hepB-mother-drugs',           // Mother uses drugs
  FAMILY_CARRIER = 'hepB-family',               // Family member is carrier/sick
}

// Pneumococcal Risk Factor Categories (per Order № 1122н and clinical guidelines)
export enum PneumoRiskFactor {
  ASPLENIA = 'pneumo-asplenia',             // Absence of spleen
  HIV = 'pneumo-hiv',                       // HIV infection
  COCHLEAR = 'pneumo-cochlear',             // Cochlear implantation
  CHRONIC_LUNG = 'pneumo-lung',             // Asthma, cystic fibrosis, etc.
  CHRONIC_HEART = 'pneumo-heart',           // Heart disease
  CHRONIC_KIDNEY = 'pneumo-kidney',         // Kidney disease
  DIABETES = 'pneumo-diabetes',             // Diabetes mellitus
  PREMATURE = 'pneumo-premature',           // Premature birth
}

// Pertussis / DTP Contraindication Categories
export enum PertussisContraindication {
  PROGRESSIVE_NEURO = 'dtp-progressive-neuro',   // Progressive neurological diseases
  AFEBRILE_SEIZURES = 'dtp-afebrile-seizures',  // History of afebrile seizures
  ENCEPHALOPATHY = 'dtp-encephalopathy',        // Encephalopathy after previous dose
}

// Polio Risk Factor Categories (Require IPV only)
export enum PolioRiskFactor {
  IMMUNODEFICIENCY = 'polio-immunodeficiency', // Primary immunodeficiency or immunosuppression
  HIV_EXPOSURE = 'polio-hiv-exposure',         // Born to HIV+ mother or HIV+ child
  NEURO_DISEASE = 'polio-neuro-disease',       // Nervous system diseases
  INTESTINAL_ANOMALY = 'polio-intestinal',     // Intestinal development anomalies
  PREMATURE_LOW_WEIGHT = 'polio-premature',    // Premature or low birth weight
  INSTITUTIONALIZED = 'polio-institutional',   // Children in orphanages/internats
  ONCOLOGY = 'polio-oncology',                 // Malignant neoplasms
}

// MMR (Measles, Mumps, Rubella) Contraindication Categories
export enum MMRContraindication {
  EGG_ALLERGY_SEVERE = 'mmr-egg-anaphylaxis',    // Anaphylaxis to egg protein (chicken or quail)
  NEOMYCIN_ALLERGY = 'mmr-neomycin',             // Allergy to aminoglycosides
  IMMUNOSUPPRESSION = 'mmr-immunosuppression',   // Severe immunosuppression or primary immunodeficiency
  PREGNANCY = 'mmr-pregnancy',                   // For patients of childbearing age
  BLOOD_PRODUCTS_RECENT = 'mmr-blood-products',  // Recent blood transfusion or IG (wait 3-11 months)
}

// Meningococcal Risk Factor Categories
export enum MeningoRiskFactor {
  DORMITORY = 'mening-dormitory',           // Resident in dormitory/hostel
  ENDEMIC_TRAVEL = 'mening-travel',         // Travel to endemic zones (Hajj, Africa)
}

// Varicella Risk Factor Categories
export enum VaricellaRiskFactor {
  CONTACT = 'varicella-contact',            // Contact with infected (SOS prophylaxis)
}

// Hepatitis A Risk Factor Categories
export enum HepARiskFactor {
  REGION_MOSCOW = 'hepa-moscow',            // Lives in Moscow (Regional Calendar - Mandatory)
  TRAVEL_SOUTH = 'hepa-travel',             // Travel to South/Asia (Recommended)
  CONTACT = 'hepa-contact',                 // Contact with infected (Emergency)
  OCCUPATIONAL = 'hepa-occupational',       // Occupational risk (Food service, etc.)
}

// Influenza Risk Factor Categories
export enum FluRiskFactor {
  STUDENT = 'flu-student',                  // School/University student
  CHRONIC = 'flu-chronic',                  // Chronic diseases (Asthma, Diabetes, Heart)
}

// HPV Risk Factor Categories
export enum HpvRiskFactor {
  REGION_MOSCOW = 'hpv-moscow',             // Lives in Moscow (Free for girls 12-13)
}

// TBE Risk Factor Categories
export enum TbeRiskFactor {
  ENDEMIC_REGION = 'tbe-endemic',           // Lives in endemic region
  TRAVEL_FOREST = 'tbe-travel',             // Plans to travel to forest/dacha
}

// Rotavirus Risk Factor Categories (Contraindications for live vaccine)
export enum RotavirusRiskFactor {
  INTUSSUSCEPTION_HISTORY = 'rota-intussusception', // History of intussusception
  GI_MALFORMATION = 'rota-gi-malformation',         // Uncorrected GI malformations
  SCID = 'rota-scid',                               // Severe Combined Immunodeficiency
}

export interface VaccinationProfile {
  id?: number;
  childId: number;
  hepBRiskFactors?: HepBRiskFactor[];
  pneumoRiskFactors?: PneumoRiskFactor[];
  pertussisContraindications?: PertussisContraindication[];
  polioRiskFactors?: PolioRiskFactor[]; // Polio specific risks (implies IPV-only)
  mmrContraindications?: MMRContraindication[]; // MMR specific risks (live vaccine rules)
  meningRiskFactors?: MeningoRiskFactor[]; // Meningococcal specific risks
  varicellaRiskFactors?: VaricellaRiskFactor[]; // Chickenpox specific risks
  hepaRiskFactors?: HepARiskFactor[]; // Hepatitis A specific risks
  fluRiskFactors?: FluRiskFactor[]; // Influenza specific risks
  hpvRiskFactors?: HpvRiskFactor[]; // HPV specific risks
  tbeRiskFactors?: TbeRiskFactor[]; // TBE specific risks
  rotaRiskFactors?: RotavirusRiskFactor[]; // Rotavirus specific risks
  birthWeight?: number | null; // Birth weight in grams, optional
  mantouxDate?: string | null;
  mantouxResult?: boolean | null;
  customVaccines?: VaccineDefinition[];
  createdAt?: string;
}

export interface VaccineBrand {
  name: string;
  country: string;
  description?: string;
}

export interface VaccineDefinition {
  id: string;
  name: string;
  disease: string;
  ageMonthStart: number;
  description?: string;
  requiredRiskFactor?: 'hepB' | string; // 'hepB' is a special module-level risk check
  excludedRiskFactor?: 'hepB' | string;
  isLive?: boolean; // Affects 30-day interval rule and contraindications
  isRecommended?: boolean; // If not in the mandatory National Calendar
  isCustom?: boolean;
  lectureId?: string;
  availableBrands?: VaccineBrand[];
}

export interface VaccineCatalogEntry {
  id?: number;
  vaccineId: string;
  name: string;
  disease: string;
  ageMonthStart: number;
  planId?: string;
  doseNumber?: number;
  minIntervalDays?: number | null;
  description?: string | null;
  requiredRiskFactor?: string | null;
  excludedRiskFactor?: string | null;
  isLive?: boolean;
  isRecommended?: boolean;
  lectureId?: string | null;
  availableBrands?: VaccineBrand[];
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface VaccinePlanDose {
  ageMonthStart: number;
  minIntervalDays?: number | null;
}

export interface VaccinePlanTemplate {
  id?: number;
  planId: string;
  vaccineBaseId: string;
  name: string;
  disease: string;
  description?: string | null;
  isLive?: boolean;
  isRecommended?: boolean;
  availableBrands?: VaccineBrand[];
  lectureId?: string | null;
  doses: VaccinePlanDose[];
  isDeleted?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserVaccineRecord {
  id?: number;
  childId?: number;
  vaccineId: string;
  isCompleted: boolean;
  completedDate: string | null;
  vaccineBrand?: string;
  notes?: string;
  dose?: string;
  series?: string;
  expiryDate?: string | null;
  manufacturer?: string | null;
  ignoreValidation?: boolean;
}

export enum VaccineStatus {
  COMPLETED = 'completed',
  DUE_NOW = 'due_now',
  OVERDUE = 'overdue',
  PLANNED = 'planned',
  MISSED = 'missed',
  SKIPPED = 'skipped'
}

export interface AugmentedVaccine extends VaccineDefinition {
  status: VaccineStatus;
  userRecord?: UserVaccineRecord;
  dueDate: Date;
  alertMessage?: string;
}

// ============= CDSS MODULE TYPES =============

// ============= ICD CODES MODULE TYPES =============

export interface IcdCode {
  uid: string;
  code: string; // "D32.0"
  name: string; // "Доброкачественное новообразование..."
  uniqueId?: number | null;
  parentId?: number | null;
  sortField?: string | null;
}

export interface IcdCodeSearchParams {
  query?: string; // Поиск по коду или названию
  category?: string; // Фильтр по категории (A-Z)
  limit?: number; // Лимит результатов
  offset?: number; // Пагинация
}

export interface IcdCodeSearchResult {
  results: IcdCode[];
  total: number;
  limit: number;
  offset: number;
}

export interface DiagnosticPlanItem {
  type: 'lab' | 'instrumental';
  test: string;
  priority?: 'low' | 'medium' | 'high';
  rationale?: string | null;
}

export interface TreatmentPlanItem {
  category: 'symptomatic' | 'etiologic' | 'supportive' | 'other';
  description: string;
  priority?: 'low' | 'medium' | 'high';
}

export type SymptomCategory = 'clinical' | 'physical' | 'other';

export interface CategorizedSymptom {
  text: string;
  category: SymptomCategory;
}

export interface Disease {
  id: number;
  icd10Code: string; // Primary code
  icd10Codes: string[]; // All related codes
  nameRu: string;
  nameEn?: string | null;
  description: string;
  symptoms: CategorizedSymptom[];
  diagnosticPlan?: DiagnosticPlanItem[];
  treatmentPlan?: TreatmentPlanItem[];
  differentialDiagnosis?: string[];
  redFlags?: string[];
  createdAt: Date;
  guidelines?: ClinicalGuideline[];
  relatedMedications?: Medication[];
}

export interface ClinicalGuideline {
  id: number;
  diseaseId: number;
  title: string;
  pdfPath?: string | null;
  content: string;
  chunks: string; // JSON string
  source?: string | null;
  createdAt: string;

  // Structured Sections
  definition?: string | null;
  etiology?: string | null;
  epidemiology?: string | null;
  classification?: string | null;
  clinicalPicture?: string | null;
  complaints?: string | null;
  physicalExam?: string | null;
  labDiagnostics?: string | null;
  instrumental?: string | null;
  treatment?: string | null;
  rehabilitation?: string | null;
  prevention?: string | null;
  medications?: string | null; // JSON string array of medications
}

export interface UploadJob {
  jobId: string;
  fileName: string;
}

export interface UploadProgress {
  jobId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  fileName: string;
  progress?: number;
  step?: string;
  error?: string;
  guidelineId?: number;
}

export interface UploadBatchFinishedEvent {
  batchId: string;
  diseaseId: number;
  totalFiles: number;
  successCount: number;
  errorCount: number;
}

export interface GuidelinePlan {
  diseaseId: number;
  diagnosticPlan: DiagnosticPlanItem[];
  treatmentPlan: TreatmentPlanItem[];
  differentialDiagnosis: string[];
  redFlags: string[];
  source: 'disease_structured' | 'guideline_raw' | 'none';
  needsReview: boolean;
  raw: {
    labDiagnostics?: string | null;
    instrumental?: string | null;
    treatment?: string | null;
    medications?: string | null;
  } | null;
}

export interface MedicationForm {
  id: string;
  type: string;
  concentration?: string | null;
  unit?: 'mg' | 'ml' | 'mcg' | 'g' | string | null;
  strengthMg?: number | null;
  mgPerMl?: number | null;
  volumeMl?: number | null;
  description?: string | null;
}

export interface FixedDose {
  min?: number | null;
  max?: number | null;
  unit?: 'mg' | 'ml' | 'mcg' | 'g' | string | null;
}

export interface AgeBasedDose {
  dose: number;
  unit?: 'mg' | 'ml' | 'mcg' | 'g' | string | null;
}

export interface DosingRule {
  type: 'weight_based' | 'bsa_based' | 'fixed' | 'age_based';
  mgPerKg?: number | null;
  maxMgPerKg?: number | null;
  mgPerM2?: number | null;
  fixedDose?: FixedDose | null;
  ageBasedDose?: AgeBasedDose | null;
}

export interface PediatricDosingRule {
  minAgeMonths?: number | null;
  maxAgeMonths?: number | null;
  minWeightKg?: number | null;
  maxWeightKg?: number | null;
  formId?: string | null;
  unit?: 'mg' | 'ml' | 'mcg' | 'g' | string | null;
  dosing?: DosingRule | null;
  routeOfAdmin?: RouteOfAdmin | null;
  timesPerDay?: number | null;
  intervalHours?: number | null;
  maxSingleDose?: number | null;
  maxSingleDosePerKg?: number | null;
  maxDailyDose?: number | null;
  maxDailyDosePerKg?: number | null;
  instruction?: string | null;
  infusion?: any | null;
}

export interface AdultDosingRule extends PediatricDosingRule { }

// Расширяем enum для путей введения
export type RouteOfAdmin =
  | 'oral'           // Перорально
  | 'rectal'         // Ректально
  | 'iv_bolus'       // В/В болюсно
  | 'iv_infusion'    // В/В капельно
  | 'iv_slow'        // В/В медленно
  | 'im'             // В/М
  | 'sc'             // П/К (подкожно)
  | 'sublingual'     // Сублингвально
  | 'topical'        // Наружно
  | 'inhalation'     // Ингаляционно
  | 'intranasal'     // Интраназально
  | 'transdermal';   // Трансдермально

export interface Medication {
  id?: number;
  nameRu: string;
  nameEn?: string | null;
  activeSubstance: string;
  atcCode?: string | null;
  icd10Codes: string[];
  packageDescription?: string | null;
  manufacturer?: string | null;
  forms: MedicationForm[];
  pediatricDosing: PediatricDosingRule[];
  adultDosing?: AdultDosingRule[] | null;
  contraindications: string;
  cautionConditions?: string | null;
  sideEffects?: string | null;
  interactions?: string | null;
  pregnancy?: string | null;
  lactation?: string | null;
  indications: any[]; // Parsed JSON
  vidalUrl?: string | null;
  // Клинико-фармакологические группы
  clinicalPharmGroup?: string | null; // "Анальгетик-антипиретик"
  pharmTherapyGroup?: string | null;  // "Анальгетики; другие анальгетики и антипиретики"
  // Новые поля для ограничений дозирования (Vidal структура)
  minInterval?: number | null; // Мин интервал между дозами (часы)
  maxDosesPerDay?: number | null; // Макс доз в сутки
  maxDurationDays?: number | null; // Макс длительность (дни)
  routeOfAdmin?: RouteOfAdmin | null;
  // Избранное и теги
  isFavorite?: boolean;
  userTags?: string[] | null;
  usageCount?: number;
  lastUsedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DiagnosisEntry {
  code?: string; // Код МКБ (необязателен при ручном вводе)
  nameRu: string; // Название диагноза на русском
  diseaseId?: number; // Опциональная связь с Disease (база знаний)
}

// ============= АНАМНЕЗ ЖИЗНИ 025/у (структурированные данные) =============

export interface HeredityData {
  tuberculosis: boolean;
  tuberculosisDetails?: string | null;
  diabetes: boolean;
  diabetesDetails?: string | null;
  hypertension: boolean;
  hypertensionDetails?: string | null;
  oncology: boolean;
  oncologyDetails?: string | null;
  allergies: boolean;
  allergiesDetails?: string | null;
  other?: string | null;
}

export interface BirthData {
  pregnancyCourse?: string | null;
  obstetricalHistory?: string | null;
  deliveryMethod?: 'natural' | 'cesarean' | null;
  gestationalAge?: number | null; // недель
  birthWeight?: number | null; // граммы
  birthHeight?: number | null; // см
  apgarScore?: string | null; // формат: 8/8 или 8/8/8
  neonatalComplications?: boolean | null;
  neonatalComplicationsDetails?: string | null;
}

export interface FeedingData {
  breastfeeding?: 'yes' | 'no' | 'mixed' | null;
  breastfeedingFrom?: string | null; // дата или возраст
  breastfeedingTo?: string | null;
  formulaName?: string | null; // название молочной смеси
  complementaryFoodAge?: number | null; // месяцев
  nutritionFeatures?: string | null;
}

export interface InfectiousDiseaseEntry {
  had: boolean;
  ageYears?: number | null;
}

export interface InfectiousDiseasesData {
  measles?: InfectiousDiseaseEntry;
  chickenpox?: InfectiousDiseaseEntry;
  rubella?: InfectiousDiseaseEntry;
  pertussis?: InfectiousDiseaseEntry;
  scarletFever?: InfectiousDiseaseEntry;
  tonsillitis?: { had: boolean; perYear?: number | null };
  other?: string | null;
}

export interface AllergyStatusData {
  food?: string | null;
  medication?: string | null;
  materials?: string | null;
  insectBites?: string | null;
  seasonal?: string | null;
}

export interface Visit {
  id?: number;
  childId: number;
  doctorId: number;
  visitDate: string;

  // Тип приема и организационные данные
  visitType?: 'primary' | 'followup' | 'consultation' | 'emergency' | 'urgent' | null;
  visitPlace?: 'clinic' | 'home' | 'other' | null;
  visitTime?: string | null; // время приема (ЧЧ:ММ)
  ticketNumber?: string | null; // номер талона 025-1/у
  referringDoctorId?: number | null; // ID направившего врача (для консультации)

  // Anthropometry
  currentWeight?: number | null; // в кг
  currentHeight?: number | null; // в см
  bmi?: number | null; // Body Mass Index
  bsa?: number | null; // Body Surface Area (м²)

  // АНАМНЕЗ ЗАБОЛЕВАНИЯ (для всех типов приема)
  diseaseOnset?: string | null; // когда началось заболевание и первые симптомы
  diseaseCourse?: string | null; // течение болезни
  treatmentBeforeVisit?: string | null; // лечение, проводимое до обращения

  // АНАМНЕЗ ЖИЗНИ 025/у (только для primary/consultation)
  heredityData?: HeredityData | string | null;
  birthData?: BirthData | string | null;
  feedingData?: FeedingData | string | null;
  infectiousDiseasesData?: InfectiousDiseasesData | string | null;
  allergyStatusData?: AllergyStatusData | string | null;

  // Показатели жизнедеятельности (Vital Signs)
  bloodPressureSystolic?: number | null; // систолическое АД (мм рт.ст.)
  bloodPressureDiastolic?: number | null; // диастолическое АД (мм рт.ст.)
  pulse?: number | null; // пульс (уд/мин)
  respiratoryRate?: number | null; // частота дыхательных движений (ЧДД)
  temperature?: number | null; // температура тела (°C)
  oxygenSaturation?: number | null; // сатурация кислорода (SpO2, %)
  consciousnessLevel?: string | null;

  // Объективный осмотр по системам (структурированный JSON)
  generalCondition?: string | null;
  consciousness?: string | null;
  skinMucosa?: string | null;
  lymphNodes?: string | null;
  musculoskeletal?: string | null;
  respiratory?: string | null;
  cardiovascular?: string | null;
  abdomen?: string | null;
  urogenital?: string | null;
  nervousSystem?: string | null;

  // Input
  complaints: string;
  complaintsJson?: any | null;
  physicalExam?: string | null;

  // Диагностика и лечение
  additionalExaminationPlan?: string | null;
  laboratoryTests?: string | any[] | null; // JSON массив или строка
  instrumentalTests?: string | any[] | null; // JSON массив или строка
  consultationRequests?: string | any[] | null; // JSON массив или строка
  physiotherapy?: string | null;
  isFirstTimeDiagnosis?: boolean | null;
  isTrauma?: boolean | null;

  // Диагнозы (структурированные с поддержкой ручного ввода и МКБ)
  primaryDiagnosis?: string | DiagnosisEntry | null; // JSON строка или объект
  complications?: string | DiagnosisEntry[] | null; // JSON массив
  comorbidities?: string | DiagnosisEntry[] | null; // JSON массив
  // Legacy поля для обратной совместимости
  primaryDiagnosisId?: number | null;
  complicationIds?: string | number[] | null;
  comorbidityIds?: string | number[] | null;

  // Treatment
  prescriptions: any[];
  recommendations?: string | null;

  // Исходы и маршрутизация
  outcome?: 'recovery' | 'improvement' | 'no_change' | 'worsening' | null;
  patientRoute?: 'ambulatory' | 'hospitalization' | 'consultation' | 'other' | null;
  hospitalizationIndication?: string | null;
  nextVisitDate?: string | null; // дата следующего приема (ГГГГ-ММ-ДД)

  // Документооборот
  disabilityCertificate?: boolean | null;
  preferentialPrescription?: boolean | null;
  certificateIssued?: boolean | null;

  status: 'draft' | 'completed';
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DiagnosisSuggestion {
  disease: Disease;
  confidence: number; // 0.0 - 1.0
  reasoning: string;
  matchedSymptoms: string[];
  isUsingFallback?: boolean; // true if AI unavailable, fallback analysis used
  phase1Score?: number; // Score from Phase 1 (BM25/semantic search)
  rankingFactors?: {
    phase1NormalizedScore: number;
    phase1SymptomScore: number;
    phase1ChunkScore: number;
    aiConfidence: number;
    aiContribution?: number;
    error?: string;
  };
}

export interface MedicationTemplateItem {
  medicationId: number;
  preferredRoute?: string | null;
  defaultDuration?: string | null;
  overrideInstruction?: string | null;
  overrideSingleDoseMg?: number | null;
  overrideTimesPerDay?: number | null;
  notes?: string | null;
}

export interface MedicationTemplate {
  id?: number;
  name: string;
  description?: string | null;
  items: string | MedicationTemplateItem[]; // JSON строка или парсированный массив
  isPublic?: boolean;
  createdById: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DiagnosticTemplate {
  id?: number;
  name: string;
  description?: string | null;
  items: string | DiagnosticPlanItem[]; // JSON строка или парсированный массив
  isPublic?: boolean;
  createdById: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DiagnosticRecommendation {
  item: DiagnosticPlanItem;
  sourceDiseaseName: string;
  sourceDiseaseId?: number;
}

// Шаблон рекомендаций
export interface RecommendationTemplate {
  id?: number;
  name: string;
  description?: string | null;
  items: string | string[]; // JSON строка или парсированный массив текстовых рекомендаций
  isPublic?: boolean;
  createdById: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DiagnosticRecommendationWithCodes extends DiagnosticRecommendation {
  icd10Codes: string[]; // Коды МКБ для фильтрации
}

export interface ExamTextTemplate {
  id?: number;
  name?: string | null;
  systemKey: string; // generalCondition, cardiovascular, etc.
  text: string;
  tags: string | string[]; // JSON строка или парсированный массив
  isPublic?: boolean;
  createdById: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface VisitTemplate {
  id?: number;
  name: string;
  visitType: string;
  specialty?: string | null;
  description?: string | null;
  templateData: string | any; // JSON со структурой полей (строка или объект)
  medicationTemplateId?: number | null;
  examTemplateSetId?: number | null; // Можно хранить как JSON массив ID в templateData
  isDefault: boolean;
  isPublic: boolean;
  createdById: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface DilutionInfo {
  enabled: boolean;
  diluentType?: 'nacl_0_9' | 'glucose_5' | 'glucose_10' | 'water_inj' | null;
  diluentVolumeMl?: number | null;
  concentrationMgPerMl?: number | null;
  finalVolumeMl?: number | null;
}

export interface MedicationRecommendation {
  medication: Medication;
  recommendedDose: DoseCalculationResult | null;
  canUse: boolean;
  warnings: string[];
  priority?: number;
  specificDosing?: string | null;
  duration?: string | null;
}

export interface DiseaseNote {
  id: number;
  diseaseId: number;
  authorId: number;
  title: string;
  content: string; // Markdown or plain text
  tags: string[]; // Parsed from JSON string
  isPinned: boolean;
  isShared: boolean;
  createdAt: string;
  updatedAt: string;
  author?: User;
}

export interface PdfNote {
  id: number;
  pdfPath: string;
  page: number;
  content: string;
  authorId: number;
  createdAt: string;
  updatedAt: string;
}

// ============= USER MANAGEMENT =============

export type UserRoleKey = 'admin' | 'doctor';

export interface User {
  id: number;
  username: string;
  lastName: string;
  firstName: string;
  middleName: string;
  isActive: boolean;
  roles: UserRoleKey[];
  createdAt?: string;
}

/** ФИО в порядке: Фамилия Имя Отчество */
export function getFullName(user: Pick<User, 'lastName' | 'firstName' | 'middleName'> | null | undefined): string {
  if (!user) return '';
  return [user.lastName, user.firstName, user.middleName].filter(Boolean).join(' ').trim() || '';
}

export interface AuthSession {
  isAuthenticated: boolean;
  user: User | null;
}

// ============= DASHBOARD MODULE TYPES =============

export interface DashboardVisitItem {
  id: number;
  childId: number;
  visitDate: string;
  visitTime: string | null;
  visitType: string | null;
  complaints: string | null;
  notes: string | null;
  primaryDiagnosis?: any | null;
  child: {
    id: number;
    name: string;
    surname: string;
    birthDate: string;
  } | null;
}

export interface DashboardSummary {
  visitsToday: DashboardVisitItem[];
  visitsTodayCount: number;
  patientsTodayCount: number;
  weeklyVisitsCount: number;
}

// ============= GLOBAL TYPES =============

// Global window extension for Electron API
declare global {
  interface Window {
    electronAPI?: {
      // LICENSE ACTIVATION API (no auth required)
      getLicenseFingerprint: () => Promise<{ fingerprint: string | null; display: string; error?: string }>;
      checkLicense: () => Promise<{ valid: boolean; reason?: string; devMode?: boolean; data?: { userName: string; expiresAt: string | null } }>;
      importLicense: () => Promise<{ success: boolean; reason?: string; data?: { userName: string; expiresAt: string | null } }>;

      // DASHBOARD MODULE API
      getDashboardSummary: (date?: string) => Promise<DashboardSummary>;
      updateVisitNotes: (visitId: number, notes: string) => Promise<boolean>;
      // PATIENTS MODULE API
      getChildren: () => Promise<ChildProfile[]>;
      getChild: (id: number) => Promise<ChildProfile>;
      createChild: (child: ChildProfile) => Promise<ChildProfile>;
      updateChild: (id: number, updates: Partial<ChildProfile>) => Promise<boolean>;
      deleteChild: (id: number) => Promise<boolean>;

      // VACCINATION MODULE API
      getVaccinationProfile: (childId: number) => Promise<VaccinationProfile>;
      updateVaccinationProfile: (profile: VaccinationProfile) => Promise<boolean>;
      getRecords: (childId: number) => Promise<UserVaccineRecord[]>;
      saveRecord: (record: UserVaccineRecord) => Promise<boolean>;
      deleteRecord: (childId: number, vaccineId: string) => Promise<boolean>;
      getVaccineCatalog: () => Promise<VaccineCatalogEntry[]>;
      upsertVaccineCatalogEntry: (entry: VaccineCatalogEntry) => Promise<VaccineCatalogEntry>;
      setVaccineCatalogEntryDeleted: (vaccineId: string, isDeleted: boolean) => Promise<VaccineCatalogEntry>;
      getVaccinePlans: () => Promise<VaccinePlanTemplate[]>;
      upsertVaccinePlan: (plan: VaccinePlanTemplate) => Promise<VaccinePlanTemplate>;
      setVaccinePlanDeleted: (planId: string, isDeleted: boolean) => Promise<VaccinePlanTemplate>;
      print: () => void;
      /** Renders HTML in a hidden Electron window and shows the native OS print dialog */
      printDocument: (payload: {
        templateId?: string;
        html: string;
        styles?: string;
        metadata?: { title?: string; [key: string]: unknown };
        options?: { pageSize?: string; orientation?: string; margins?: { top: number; right: number; bottom: number; left: number } };
      }) => Promise<{ success: boolean; error?: string; fallback?: 'pdf'; path?: string }>;
      exportPDF: (payload: {
        templateId: string;
        data: any;
        metadata: { title: string; createdAt?: any; author?: string; organization?: string; custom?: Record<string, unknown> };
        options?: { pageSize?: string; orientation?: string; margins?: { top: number; right: number; bottom: number; left: number } };
        html?: string;
        styles?: string;
      }) => Promise<
        | string
        | { success: boolean; path?: string; error?: string }
      >;
      closeApp: () => void;
      openFile: (options?: any) => Promise<{ canceled: boolean; filePaths: string[] }>;
      readTextFile: (filePath: string) => Promise<string>;
      createBackup: () => Promise<{ success: boolean; path?: string; error?: string }>;

      // CACHE MANAGEMENT API
      getCacheStats: () => Promise<{
        namespaces: Record<string, { size: number; expired: number; ttl: number }>;
        totalSize: number;
        maxSize: number;
        stats: {
          hits: number;
          misses: number;
          sets: number;
          invalidations: number;
          hitRate: string;
        };
      }>;
      clearAllCache: () => Promise<{ success: boolean }>;
      clearCacheNamespace: (namespace: string) => Promise<{ success: boolean }>;

      // SYSTEM API
      openExternalPath: (path: string) => Promise<string>;
      openPdfAtPage: (path: string, page: number) => Promise<{ success: boolean }>;

      // AUTH API
      login: (credentials: { username: string; password: string }) => Promise<{ success: boolean; user?: User; error?: string }>;
      logout: () => Promise<{ success: boolean }>;
      checkSession: () => Promise<AuthSession>;

      // USER MANAGEMENT API (Admin only)
      registerUser: (data: { username: string; password: string; lastName: string; firstName?: string; middleName?: string; isAdmin: boolean }) => Promise<{ success: boolean; user?: User; error?: string }>;
      getAllUsers: () => Promise<User[]>;
      deactivateUser: (userId: number) => Promise<{ success: boolean; error?: string }>;
      activateUser: (userId: number) => Promise<{ success: boolean; error?: string }>;
      changePassword: (data: { userId: number; oldPassword?: string; newPassword: string }) => Promise<{ success: boolean; error?: string }>;
      updateUser: (data: { userId: number; username: string; lastName: string; firstName?: string; middleName?: string; isActive: boolean }) => Promise<{ success: boolean; user?: User; error?: string }>;
      setUserRoles: (data: { userId: number; roles: UserRoleKey[] }) => Promise<{ success: boolean; error?: string }>;
      resetPassword: (data: { userId: number; newPassword: string }) => Promise<{ success: boolean; error?: string }>;

      // PATIENT SHARING API
      sharePatient: (data: { childId: number; userId: number; canEdit: boolean }) => Promise<{ success: boolean; error?: string }>;
      unsharePatient: (data: { childId: number; userId: number }) => Promise<{ success: boolean; error?: string }>;

      // PATIENT ALLERGIES API
      getPatientAllergies: (childId: number) => Promise<PatientAllergy[]>;
      createPatientAllergy: (data: PatientAllergy) => Promise<PatientAllergy>;
      updatePatientAllergy: (id: number, data: Partial<PatientAllergy>) => Promise<PatientAllergy>;
      deletePatientAllergy: (id: number) => Promise<boolean>;

      // DISEASES MODULE API
      getDiseases: () => Promise<Disease[]>;
      getDisease: (id: number) => Promise<Disease & { guidelines: ClinicalGuideline[] }>;
      upsertDisease: (data: Disease) => Promise<Disease>;
      deleteDisease: (id: number) => Promise<boolean>;
      uploadGuideline: (diseaseId: number, pdfPath: string) => Promise<ClinicalGuideline>;
      uploadGuidelinesBatch: (diseaseId: number, pdfPaths: string[]) => Promise<{ success: ClinicalGuideline[]; errors: Array<{ path: string; error: string }> | null }>;
      uploadGuidelinesAsync: (diseaseId: number, pdfPaths: string[]) => Promise<{ batchId: string; jobs: UploadJob[] }>;
      getUploadStatus: (jobIds: string[]) => Promise<UploadProgress[]>;
      onUploadProgress: (callback: (event: any, progress: UploadProgress) => void) => () => void;
      onUploadBatchFinished: (callback: (event: any, data: UploadBatchFinishedEvent) => void) => () => void;
      updateGuideline: (id: number, data: Partial<ClinicalGuideline>) => Promise<ClinicalGuideline>;
      deleteGuideline: (guidelineId: number) => Promise<boolean>;
      searchDiseases: (symptoms: string[]) => Promise<Disease[]>;
      getGuidelinePlan: (diseaseId: number) => Promise<GuidelinePlan>;
      importDiseaseFromJson: (jsonString: string) => Promise<{
        success: boolean;
        data?: Disease;
        validation?: {
          isValid: boolean;
          errors: any[];
          warnings: any[];
          needsReview: boolean;
        };
        error?: string;
      }>;

      // Disease Notes (Personal or Shared)
      getDiseaseNotes: (diseaseId: number) => Promise<DiseaseNote[]>;
      createDiseaseNote: (data: Partial<DiseaseNote>) => Promise<DiseaseNote>;
      updateDiseaseNote: (id: number, data: Partial<DiseaseNote>) => Promise<DiseaseNote>;
      deleteDiseaseNote: (id: number) => Promise<boolean>;

      // PDF Notes
      getPdfNotes: (params: { pdfPath: string; page?: number }) => Promise<PdfNote[]>;
      createPdfNote: (data: Partial<PdfNote>) => Promise<PdfNote>;
      updatePdfNote: (id: number, data: Partial<PdfNote>) => Promise<PdfNote>;
      deletePdfNote: (id: number) => Promise<boolean>;

      // PDF parsing
      parsePdfOnly: (pdfPath: string) => Promise<{
        icd10Code: string;
        allIcd10Codes: string[];
        nameRu: string;
        description: string;
        symptoms: string[];
        medications: any[];
        aiUsed: boolean;
        aiWarning: string | null;
        pdfPath: string;
      }>;
      readPdfFile: (path: string) => Promise<Uint8Array>;

      // MEDICATIONS MODULE API
      getMedications: () => Promise<Medication[]>;
      getMedication: (id: number) => Promise<Medication & { diseases: any[] }>;
      upsertMedication: (data: Medication) => Promise<Medication>;
      deleteMedication: (id: number) => Promise<boolean>;
      linkMedicationToDisease: (data: { diseaseId: number; medicationId: number; priority?: number; dosing?: string; duration?: string }) => Promise<any>;
      calculateDose: (params: { medicationId: number; weight: number; ageMonths: number; height?: number | null; ruleIndex?: number }) => Promise<DoseCalculationResult>;
      getMedicationsByDisease: (diseaseId: number) => Promise<Medication[]>;
      checkDuplicateMedication: (nameRu: string, excludeId?: number) => Promise<{
        success: boolean;
        hasDuplicate: boolean;
        duplicate?: Medication | null;
        error?: string;
      }>;
      importFromVidal: (url: string) => Promise<{
        success: boolean;
        data?: Medication;
        validation?: {
          isValid: boolean;
          errors: any[];
          warnings: any[];
          needsReview: boolean;
        };
        error?: string
      }>;
      importFromJson: (jsonString: string) => Promise<{
        success: boolean;
        data?: Medication;
        validation?: {
          isValid: boolean;
          errors: any[];
          warnings: any[];
          needsReview: boolean;
        };
        error?: string;
      }>;
      getPharmacologicalGroups: () => Promise<string[]>;
      getFormTypes: () => Promise<string[]>;
      searchMedicationsByGroup: (groupName: string) => Promise<Medication[]>;
      toggleMedicationFavorite: (medicationId: number) => Promise<boolean>;
      addMedicationTag: (medicationId: number, tag: string) => Promise<boolean>;
      getMedicationChangeHistory: (medicationId: number) => Promise<any[]>;

      // VISITS MODULE API
      getVisits: (childId: number) => Promise<Visit[]>;
      getVisit: (id: number) => Promise<Visit>;
      upsertVisit: (data: Visit) => Promise<Visit>;
      deleteVisit: (id: number) => Promise<boolean>;
      analyzeVisit: (visitId: number) => Promise<DiagnosisSuggestion[]>;
      getMedicationsForDiagnosis: (params: { diseaseId: number; childId: number }) => Promise<MedicationRecommendation[]>;
      getMedicationsByIcdCode: (params: { icdCode: string; childId: number }) => Promise<MedicationRecommendation[]>;
      getExpandedIcdCodes: (icdCodes: string[]) => Promise<string[]>;

      // MEDICATION TEMPLATES API
      getMedicationTemplate: (id: number) => Promise<MedicationTemplate | null>;
      getAllMedicationTemplates: (userId: number) => Promise<MedicationTemplate[]>;
      upsertMedicationTemplate: (data: MedicationTemplate) => Promise<MedicationTemplate>;
      deleteMedicationTemplate: (id: number, userId: number) => Promise<boolean>;
      prepareMedicationTemplateApplication: (params: { templateId: number; childWeight: number; childAgeMonths: number; childHeight?: number | null }) => Promise<MedicationTemplateItem[]>;

      // DIAGNOSTIC TEMPLATES API
      getDiagnosticTemplate: (id: number) => Promise<DiagnosticTemplate | null>;
      getAllDiagnosticTemplates: (userId: number) => Promise<DiagnosticTemplate[]>;
      upsertDiagnosticTemplate: (data: DiagnosticTemplate) => Promise<DiagnosticTemplate>;
      deleteDiagnosticTemplate: (id: number, userId: number) => Promise<boolean>;
      getDiagnosticsByIcdCode: (icdCode: string) => Promise<DiagnosticRecommendation[]>;
      getAllDiagnosticTests: () => Promise<DiagnosticRecommendationWithCodes[]>;

      // RECOMMENDATION TEMPLATES API
      getRecommendationTemplates: (userId: number) => Promise<RecommendationTemplate[]>;
      getRecommendationTemplate: (id: number) => Promise<RecommendationTemplate | null>;
      upsertRecommendationTemplate: (data: RecommendationTemplate) => Promise<RecommendationTemplate>;
      deleteRecommendationTemplate: (id: number, userId: number) => Promise<boolean>;

      // ICD CODES MODULE API
      loadIcdCodes: () => Promise<{ success: boolean; count: number }>;
      getIcdCodeByCode: (code: string) => Promise<IcdCode | null>;
      searchIcdCodes: (params: IcdCodeSearchParams) => Promise<IcdCodeSearchResult>;
      getIcdCodesByCategory: (params: { category: string; limit?: number; offset?: number }) => Promise<IcdCodeSearchResult>;
      getAllIcdCodes: (params: { limit?: number; offset?: number }) => Promise<IcdCodeSearchResult>;
      getIcdCategories: () => Promise<string[]>;

      // API KEYS POOL MANAGEMENT API
      getApiKeysPoolStatus: () => Promise<{
        total: number;
        active: number;
        failed: number;
        currentKeyIndex: number;
        needsAttention: boolean;
        keys: Array<{
          index: number;
          status: 'active' | 'failed';
          errorCount: number;
          lastUsed: string | null;
          lastError: string | null;
        }>;
      }>;
      resetApiKey: (keyIndex: number) => Promise<boolean>;
      resetAllApiKeys: () => Promise<boolean>;
      reloadApiKeysFromEnv: () => Promise<{ success: boolean; keysCount: number }>;
      onApiKeysLowWarning: (callback: (event: any, data: { remaining: number; total: number }) => void) => void;

      // NUTRITION MODULE API
      getNutritionAgeNorms: () => Promise<NutritionAgeNorm[]>;
      getNutritionProductCategories: () => Promise<NutritionProductCategory[]>;
      getNutritionProducts: (categoryId?: number | null) => Promise<NutritionProduct[]>;
      upsertNutritionProduct: (data: Partial<NutritionProduct>) => Promise<NutritionProduct>;
      deleteNutritionProduct: (id: number) => Promise<boolean>;
      bulkUpsertNutritionProducts: (products: unknown[]) => Promise<Array<{ index: number; status: 'success' | 'error'; id?: number; name: string; errors?: string[] }>>;
      getNutritionTemplates: (ageDays?: number | null) => Promise<NutritionFeedingTemplate[]>;
      getNutritionTemplateItems: (templateId: number) => Promise<NutritionFeedingTemplateItem[]>;
      upsertNutritionTemplate: (data: NutritionTemplateUpsertInput) => Promise<NutritionFeedingTemplate>;
      deleteNutritionTemplate: (id: number) => Promise<boolean>;
      getChildFeedingPlans: (childId: number) => Promise<ChildFeedingPlan[]>;
      saveChildFeedingPlan: (data: Partial<ChildFeedingPlan>) => Promise<ChildFeedingPlan>;
      deleteChildFeedingPlan: (id: number) => Promise<boolean>;
    }
  }
}

// ============= NUTRITION MODULE TYPES =============

export type FeedingType = 'BF' | 'MF' | 'FF';

export type FormulaType =
  | 'standard'
  | 'hydrolysate'
  | 'amino-acid'
  | 'soy'
  | 'AR'     // anti-reflux
  | 'LF'     // lactose-free
  | 'premature'
  | string;

export interface NutritionAgeNorm {
  id: number;
  feedingStage: string;
  ageMinDays: number;
  ageMaxDays: number;
  energyKcalPerKg: number | null;
  fixedEnergyKcal: number | null;
  volumeFactorMin: number | null;
  volumeFactorMax: number | null;
  totalFoodMinG: number | null;
  totalFoodMaxG: number | null;
  mealsPerDay: number;
  notes: string | null;
  createdAt: string;
}

export interface NutritionProductCategory {
  id: number;
  code: string;
  name: string;
  minAgeDays: number;
  maxAgeDays: number;
  createdAt: string;
}

export interface NutritionProduct {
  id: number;
  categoryId: number;
  brand: string | null;
  name: string;
  energyKcalPer100ml: number | null;
  energyKcalPer100g: number | null;
  proteinGPer100g: number | null;
  fatGPer100g: number | null;
  carbsGPer100g: number | null;
  minAgeDays: number;
  maxAgeDays: number;
  formulaType: FormulaType | null;
  isArchived: boolean;
  compositionJson: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined from category
  category?: { code: string; name: string };
}

export interface NutritionFeedingTemplate {
  id: number;
  ageMinDays: number;
  ageMaxDays: number;
  title: string;
  description: string | null;
  createdAt: string;
}

export interface NutritionFeedingTemplateItem {
  id: number;
  templateId: number;
  mealOrder: number;
  productCategoryId: number;
  portionSizeG: number;
  isExample: boolean;
  note: string | null;
  // Joined from category
  productCategory?: { code: string; name: string };
}

export interface NutritionTemplateItemInput {
  mealOrder: number;
  productCategoryId: number;
  portionSizeG: number;
  isExample?: boolean;
  note?: string | null;
}

export interface NutritionTemplateUpsertInput {
  id?: number;
  ageMinDays: number;
  ageMaxDays: number;
  title: string;
  description?: string | null;
  items: NutritionTemplateItemInput[];
}

export interface ChildFeedingPlan {
  id: number;
  childId: number;
  createdByUserId: number;
  date: string;
  ageDays: number;
  weightKg: number;
  birthWeightG: number | null;
  feedingType: FeedingType;
  dailyEnergyNeedKcal: number;
  dailyVolumeNeedMl: number | null;
  mealsPerDay: number;
  estimatedBreastMilkMl: number | null;
  formulaVolumeMl: number | null;
  formulaId: number | null;
  comments: string | null;
  createdAt: string;
  // Joined
  formula?: { id: number; name: string; brand: string | null; energyKcalPer100ml: number | null } | null;
}