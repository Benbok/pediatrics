// ============= PATIENTS MODULE TYPES =============
// Basic patient information ONLY - no vaccination logic

export interface ChildProfile {
  id?: number;
  name: string;
  surname: string;
  patronymic?: string;
  birthDate: string; // ISO string YYYY-MM-DD
  birthWeight: number; // in grams
  gender: 'male' | 'female';
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

// ============= USER MANAGEMENT =============

export interface User {
  id: number;
  username: string;
  fullName: string;
  isAdmin: boolean;
  isActive: boolean;
  createdAt?: string;
}

export interface AuthSession {
  isAuthenticated: boolean;
  user: User | null;
}

// ============= GLOBAL TYPES =============

// Global window extension for Electron API
declare global {
  interface Window {
    electronAPI: {
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
      print: () => void;
      exportPDF: (certificateData: any) => Promise<string>;
      closeApp: () => void;
      openFile: (options?: any) => Promise<{ canceled: boolean; filePaths: string[] }>;
      readTextFile: (filePath: string) => Promise<string>;
      createBackup: () => Promise<{ success: boolean; path?: string; error?: string }>;

      // AUTH API
      login: (credentials: { username: string; password: string }) => Promise<{ success: boolean; user?: User; error?: string }>;
      logout: () => Promise<{ success: boolean }>;
      checkSession: () => Promise<AuthSession>;

      // USER MANAGEMENT API (Admin only)
      registerUser: (data: { username: string; password: string; fullName: string; isAdmin: boolean }) => Promise<{ success: boolean; user?: User; error?: string }>;
      getAllUsers: () => Promise<User[]>;
      deactivateUser: (userId: number) => Promise<{ success: boolean; error?: string }>;
      activateUser: (userId: number) => Promise<{ success: boolean; error?: string }>;
      changePassword: (data: { userId: number; oldPassword?: string; newPassword: string }) => Promise<{ success: boolean; error?: string }>;

      // PATIENT SHARING API
      sharePatient: (data: { childId: number; userId: number; canEdit: boolean }) => Promise<{ success: boolean; error?: string }>;
      unsharePatient: (data: { childId: number; userId: number }) => Promise<{ success: boolean; error?: string }>;
    }
  }
}