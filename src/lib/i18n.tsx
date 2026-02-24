"use client";

import { createContext, useContext, useState, useMemo, useCallback, useEffect, ReactNode } from "react";

export type Language = "en" | "zh";

/**
 * Detect the user's preferred language from browser settings.
 * Defaults to Chinese ("zh") if no English preference is detected.
 */
function detectLanguage(): Language {
  if (typeof window === "undefined") return "zh"; // SSR default to Chinese

  try {
    // Check navigator.language and navigator.languages
    const browserLang = navigator.language || (navigator.languages && navigator.languages[0]);

    if (browserLang) {
      // If browser language starts with "en", use English
      if (browserLang.toLowerCase().startsWith("en")) {
        return "en";
      }
    }
  } catch {
    // If any error, default to Chinese
  }

  // Default to Chinese for all other cases
  return "zh";
}

const translations = {
  en: {
    // Header
    familyName: "Qi (戚) Family",
    familyGenealogy: "Family Genealogy",
    addPerson: "Add Person",
    loading: "Loading...",

    // Legend
    male: "Male",
    female: "Female",
    marriage: "Marriage",
    clickToExpand: "Click any name to expand details",

    // Detail Panel
    edit: "Edit",
    birth: "Birth",
    death: "Death",
    age: "Age",
    years: " years",
    approx: "(approx)",
    saveChanges: "Save Changes",
    saving: "Saving...",
    cancel: "Cancel",
    status: "Status",
    statusUnknown: "Unknown",
    statusPassed: "Passed at ",
    statusLiving: "Living at",
    statusLivingShort: "living",
    statusPassedUnknownAge: "Passed at unknown age",
    father: "Father",
    mother: "Mother",
    spouse: "Spouse",

    // Form Labels
    chineseName: "Chinese Name",
    pinyinEnglishName: "Pinyin / English Name",
    gender: "Gender",
    dates: "Dates",
    birthDate: "Birth Date",
    deathDate: "Death Date",
    approximateDate: "Approximate date",
    relationships: "Relationships",
    parentsMax2: "Parents (max 2)",
    partnerSpouse: "Partner/Spouse",
    children: "Children",
    notes: "Notes",
    optional: "(optional)",
    required: "*",

    // Placeholders
    chineseNamePlaceholder: "e.g., 戚继光",
    pinyinPlaceholder: "e.g., Qi Jiguang or James Qi",
    datePlaceholder: "YYYY-MM-DD",
    notesPlaceholder: "Brief note about this person",
    description: "Description",
    descriptionPlaceholder: "Write a biographical overview of this person...",
    searchParents: "Search for parents...",
    searchPartner: "Search for partner...",
    searchChildren: "Search for children to link...",
    searchPerson: "Search for a person...",

    // Modal
    addNewPerson: "Add New Person",
    addChild: "Add Child",
    addSpouse: "Add Spouse",
    close: "Close",

    // Validation
    chineseNameRequired: "Chinese name is required",
    pinyinRequired: "Pinyin is required",
    noMatches: "No matches found",
    selected: "selected",

    // Errors
    failedToSave: "Failed to save",
    saveFailed: "Save failed",
    retry: "Retry",
    updatesNotSupported: "Updates not supported",

    // Delete
    delete: "Delete",
    confirmDelete: "Are you sure you want to delete this person? This cannot be undone.",
    deleting: "Deleting...",

    // Validation warnings
    dataIntegrityWarning: "Data Integrity Warning",
    partnerLinkIssues: "Some partner relationships are not bidirectional:",
    dismiss: "Dismiss",

    // Floating nodes sidebar
    unconnectedPeople: "Unconnected",
    unconnectedDescription: "People not yet linked to the tree",
    noUnconnected: "All members are connected to the tree",

    // Edit relationships modal
    editRelationships: "Edit Relationships",
    editRelationshipsHelp: "Connect this person to the family tree by selecting their parents or children.",

    // Person selection
    clickPersonInTree: "Click a person in the tree to add...",

    // Historical events
    historicalEvents: "Historical Context",
    yearsOldDuring: " years old at start",
    yearsOld: "years old",
    born: "Born",

    // Subtree collapse/expand
    collapseSubtree: "Collapse",
    expandSubtree: "Expand",

    // Link
    link: "Link",
    linkPlaceholder: "https://en.wikipedia.org/wiki/...",
    viewLink: "View link",

    // Images
    photos: "Photos",
    noPhotos: "No photos yet",
    uploadPhoto: "Upload Photo",
    addPhoto: "Add Photo",
    dragDropPhoto: "Drag and drop an image, or click to select",
    uploading: "Uploading...",
    uploadFailed: "Upload failed",
    deletePhoto: "Delete Photo",
    confirmDeletePhoto: "Are you sure you want to delete this photo?",
    photoCaption: "Caption",
    captionPlaceholder: "Add a caption...",
    dateTaken: "Date Taken",
    taggedPeople: "People in this photo",
    addTag: "Add person",
    removeTag: "Remove",
    suggested: "Suggested",
    allPeople: "All People",
    setAsAvatar: "Set as Avatar",
    replaceAvatar: "Replace Avatar",
    removeAvatar: "Remove Avatar",
    adjustCrop: "Adjust Crop",
    saveCrop: "Save",
    cancelCrop: "Cancel",
    avatarSet: "Avatar set successfully",
    avatarRemoved: "Avatar removed",
    viewFullSize: "View full size",
    closeModal: "Close",

    // Favorites
    favorites: "Favorites",
    addToFavorites: "Add to favorites",
    removeFromFavorites: "Remove from favorites",

    // Mobile View
    mobileView: "Mobile",

    // Source Documents
    sourceDocuments: "Source Documents",
    sourceDocumentsDesc: "Historical documents and research materials",
    uploadDocument: "Upload Document",
    documentTitle: "Title",
    documentTitlePlaceholder: "e.g., Birth certificate, Letter from 1920...",
    documentDate: "Document Date",
    sourceNotes: "Research Notes",
    sourceNotesPlaceholder: "Add research notes, transcription, context...",
    sourceLocation: "Archive Location",
    sourceLocationPlaceholder: "e.g., Box 3, Qi family archives",
    noDocuments: "No documents yet",
    noDocumentsDesc: "Upload historical source documents to begin your research archive.",
    viewDocument: "View Document",
    editDocument: "Edit Document",
    deleteDocument: "Delete Document",
    confirmDeleteDocument: "Are you sure you want to delete this document?",
    sortByUpload: "Sort by upload date",
    sortByDocument: "Sort by document date",
    magnifier: "Magnifier",
    magnifierOn: "On",
    magnifierOff: "Off",
    zoom: "Zoom",
    filterPresets: "Filter Presets",
    customFilters: "Custom Filters",
    presetOriginal: "Original",
    presetFadedInk: "Faded Ink",
    presetYellowedPaper: "Yellowed Paper",
    presetHighContrast: "High Contrast",
    presetPhotoNegative: "Photo Negative",
    presetHandwriting: "Handwriting",
    // Basic adjustments
    basicAdjustments: "Basic Adjustments",
    brightness: "Brightness",
    contrast: "Contrast",
    gamma: "Gamma",

    // Color filters
    colorFilters: "Color",
    grayscale: "Grayscale",
    invert: "Invert",
    channelMode: "Channel",

    // Sharpening
    sharpening: "Sharpening",
    unsharpAmount: "Amount",
    unsharpRadius: "Radius",

    // Binarization
    binarization: "Binarization",
    threshold: "Threshold",
    adaptiveThreshold: "Adaptive (Sauvola)",
    adaptiveK: "Sensitivity (k)",
    adaptiveRadius: "Window Size",

    // Reset
    resetToOriginal: "Reset to Original",

    backToGallery: "Back to Gallery",

    // Upcoming dates banner
    upcomingBirthdays: "Upcoming Birthdays",
    upcomingMemorials: "Upcoming Memorials",
    birthdayOn: "birthday on",
    memorialOn: "memorial on",
    turningAge: "turning",
    yearsAgo: "years ago",

    // Partnership status
    married: "Married",
    divorced: "Divorced",
    widowed: "Widowed",
    partner: "Partner",
    marriageDate: "Marriage Date",
    divorceDate: "Divorce Date",
    partnershipStatus: "Status",
    exSpouse: "Ex-spouse",
    formerlyMarried: "formerly married",

    // Multi-appearance navigation
    cycleAppearances: "Cycle through appearances",

    // Mobile-specific
    qiFamilyTree: "Qi Family Tree",
    searchResults: "Search Results",
    familyMembers: "Family Members",
    noConnectedFamily: "No connected family members",
    back: "Back",
    home: "Home",
    birthYearUnknown: "Birth year unknown",
    tapToSelectPhoto: "Tap to select photo",
    compressing: "Compressing...",
    compressed: "compressed",
    tagPeople: "Tag People",
    searchToAddMore: "Search to add more...",
    searchByName: "Search by name...",
    add: "Add",
    siblings: "Siblings",

    // Short forms for mini diagram
    fatherShort: "Father",
    motherShort: "Mother",
    parentShort: "Parent",
    spouseShort: "Spouse",
    childShort: "Child",

    // Relationship labels for tagging
    relationSpouse: "Spouse",
    relationFather: "Father",
    relationMother: "Mother",
    relationParent: "Parent",
    relationSon: "Son",
    relationDaughter: "Daughter",
    relationChild: "Child",
    relationBrother: "Brother",
    relationSister: "Sister",
    relationSibling: "Sibling",
    relationGrandfather: "Grandfather",
    relationGrandmother: "Grandmother",
    relationGrandparent: "Grandparent",
    relationGrandson: "Grandson",
    relationGranddaughter: "Granddaughter",
    relationGrandchild: "Grandchild",
    relationFatherInLaw: "Father-in-law",
    relationMotherInLaw: "Mother-in-law",
    relationParentInLaw: "Parent-in-law",
    relationBrotherInLaw: "Brother-in-law",
    relationSisterInLaw: "Sister-in-law",
    relationSiblingInLaw: "Sibling-in-law",
    relationUncle: "Uncle",
    relationAunt: "Aunt",
    relationAuntUncle: "Aunt/Uncle",
    relationCousin: "Cousin",
  },
  zh: {
    // Header
    familyName: "戚氏家族",
    familyGenealogy: "家谱",
    addPerson: "添加成员",
    loading: "加载中...",

    // Legend
    male: "男",
    female: "女",
    marriage: "婚姻",
    clickToExpand: "点击姓名查看详情",

    // Detail Panel
    edit: "编辑",
    birth: "出生",
    death: "去世",
    age: "年龄",
    years: "岁",
    approx: "(约)",
    saveChanges: "保存",
    saving: "保存中...",
    cancel: "取消",
    status: "状态",
    statusUnknown: "未知",
    statusPassed: "享年",
    statusLiving: "现年",
    statusLivingShort: "在世",
    statusPassedUnknownAge: "已故，享年不详",
    father: "父亲",
    mother: "母亲",
    spouse: "配偶",

    // Form Labels
    chineseName: "中文名",
    pinyinEnglishName: "拼音 / 英文名",
    gender: "性别",
    dates: "日期",
    birthDate: "出生日期",
    deathDate: "去世日期",
    approximateDate: "大约日期",
    relationships: "关系",
    parentsMax2: "父母 (最多2位)",
    partnerSpouse: "配偶",
    children: "子女",
    notes: "备注",
    optional: "(可选)",
    required: "*",

    // Placeholders
    chineseNamePlaceholder: "例如：戚继光",
    pinyinPlaceholder: "例如：Qi Jiguang",
    datePlaceholder: "YYYY-MM-DD",
    notesPlaceholder: "简短备注",
    description: "简介",
    descriptionPlaceholder: "撰写此人的生平概述...",
    searchParents: "搜索父母...",
    searchPartner: "搜索配偶...",
    searchChildren: "搜索要链接的子女...",
    searchPerson: "搜索成员...",

    // Modal
    addNewPerson: "添加新成员",
    addChild: "添加子女",
    addSpouse: "添加配偶",
    close: "关闭",

    // Validation
    chineseNameRequired: "请输入中文名",
    pinyinRequired: "请输入拼音",
    noMatches: "未找到匹配项",
    selected: "已选",

    // Errors
    failedToSave: "保存失败",
    saveFailed: "保存失败",
    retry: "重试",
    updatesNotSupported: "不支持更新",

    // Delete
    delete: "删除",
    confirmDelete: "确定要删除此人吗？此操作无法撤销。",
    deleting: "删除中...",

    // Validation warnings
    dataIntegrityWarning: "数据完整性警告",
    partnerLinkIssues: "部分配偶关系不是双向的：",
    dismiss: "关闭",

    // Floating nodes sidebar
    unconnectedPeople: "未连接",
    unconnectedDescription: "尚未连接到家谱的成员",
    noUnconnected: "所有成员都已连接到家谱",

    // Edit relationships modal
    editRelationships: "编辑关系",
    editRelationshipsHelp: "通过选择父母或子女将此人连接到家谱。",

    // Person selection
    clickPersonInTree: "点击家谱中的人员添加...",

    // Historical events
    historicalEvents: "历史背景",
    yearsOldDuring: "岁时经历",
    yearsOld: "岁",
    born: "出生",

    // Subtree collapse/expand
    collapseSubtree: "收起",
    expandSubtree: "展开",

    // Link
    link: "链接",
    linkPlaceholder: "https://zh.wikipedia.org/wiki/...",
    viewLink: "查看链接",

    // Images
    photos: "照片",
    noPhotos: "暂无照片",
    uploadPhoto: "上传照片",
    addPhoto: "添加照片",
    dragDropPhoto: "拖放图片，或点击选择",
    uploading: "上传中...",
    uploadFailed: "上传失败",
    deletePhoto: "删除照片",
    confirmDeletePhoto: "确定要删除这张照片吗？",
    photoCaption: "描述",
    captionPlaceholder: "添加描述...",
    dateTaken: "拍摄日期",
    taggedPeople: "照片中的人",
    addTag: "添加人物",
    removeTag: "移除",
    suggested: "推荐",
    allPeople: "所有成员",
    setAsAvatar: "设为头像",
    replaceAvatar: "更换头像",
    removeAvatar: "移除头像",
    adjustCrop: "调整裁剪",
    saveCrop: "保存",
    cancelCrop: "取消",
    avatarSet: "头像设置成功",
    avatarRemoved: "头像已移除",
    viewFullSize: "查看原图",
    closeModal: "关闭",

    // Favorites
    favorites: "收藏",
    addToFavorites: "添加到收藏",
    removeFromFavorites: "从收藏中移除",

    // Mobile View
    mobileView: "移动端",

    // Source Documents
    sourceDocuments: "原始文献",
    sourceDocumentsDesc: "历史文献和研究资料",
    uploadDocument: "上传文献",
    documentTitle: "标题",
    documentTitlePlaceholder: "例如：出生证明、1920年信件...",
    documentDate: "文献日期",
    sourceNotes: "研究笔记",
    sourceNotesPlaceholder: "添加研究笔记、转录内容、背景信息...",
    sourceLocation: "档案位置",
    sourceLocationPlaceholder: "例如：第3箱，戚氏家族档案",
    noDocuments: "暂无文献",
    noDocumentsDesc: "上传历史原始文献，开始建立您的研究档案。",
    viewDocument: "查看文献",
    editDocument: "编辑文献",
    deleteDocument: "删除文献",
    confirmDeleteDocument: "确定要删除这份文献吗？",
    sortByUpload: "按上传日期排序",
    sortByDocument: "按文献日期排序",
    magnifier: "放大镜",
    magnifierOn: "开启",
    magnifierOff: "关闭",
    zoom: "缩放",
    filterPresets: "滤镜预设",
    customFilters: "自定义滤镜",
    presetOriginal: "原始",
    presetFadedInk: "褪色墨迹",
    presetYellowedPaper: "泛黄纸张",
    presetHighContrast: "高对比度",
    presetPhotoNegative: "照片负片",
    presetHandwriting: "手写体",
    // Basic adjustments
    basicAdjustments: "基本调整",
    brightness: "亮度",
    contrast: "对比度",
    gamma: "伽马",

    // Color filters
    colorFilters: "颜色",
    grayscale: "灰度",
    invert: "反色",
    channelMode: "通道",

    // Sharpening
    sharpening: "锐化",
    unsharpAmount: "强度",
    unsharpRadius: "半径",

    // Binarization
    binarization: "二值化",
    threshold: "阈值",
    adaptiveThreshold: "自适应 (Sauvola)",
    adaptiveK: "灵敏度 (k)",
    adaptiveRadius: "窗口大小",

    // Reset
    resetToOriginal: "重置为原始",

    backToGallery: "返回相册",

    // Upcoming dates banner
    upcomingBirthdays: "即将到来的生日",
    upcomingMemorials: "即将到来的忌日",
    birthdayOn: "生日",
    memorialOn: "忌日",
    turningAge: "即将",
    yearsAgo: "年前",

    // Partnership status
    married: "已婚",
    divorced: "离异",
    widowed: "丧偶",
    partner: "伴侣",
    marriageDate: "结婚日期",
    divorceDate: "离婚日期",
    partnershipStatus: "状态",
    exSpouse: "前配偶",
    formerlyMarried: "曾结婚",

    // Multi-appearance navigation
    cycleAppearances: "循环切换位置",

    // Mobile-specific
    qiFamilyTree: "戚氏家谱",
    searchResults: "搜索结果",
    familyMembers: "家族成员",
    noConnectedFamily: "暂无关联家庭成员",
    back: "返回",
    home: "主页",
    birthYearUnknown: "生年不详",
    tapToSelectPhoto: "点击选择照片",
    compressing: "压缩中...",
    compressed: "已压缩",
    tagPeople: "标记人物",
    searchToAddMore: "搜索添加更多人...",
    searchByName: "搜索姓名...",
    add: "添加",
    siblings: "兄弟姐妹",

    // Short forms for mini diagram
    fatherShort: "父",
    motherShort: "母",
    parentShort: "父/母",
    spouseShort: "配",
    childShort: "子",

    // Relationship labels for tagging
    relationSpouse: "配偶",
    relationFather: "父亲",
    relationMother: "母亲",
    relationParent: "父母",
    relationSon: "儿子",
    relationDaughter: "女儿",
    relationChild: "子女",
    relationBrother: "兄弟",
    relationSister: "姐妹",
    relationSibling: "兄弟姐妹",
    relationGrandfather: "祖父",
    relationGrandmother: "祖母",
    relationGrandparent: "祖父母",
    relationGrandson: "孙子",
    relationGranddaughter: "孙女",
    relationGrandchild: "孙辈",
    relationFatherInLaw: "岳父/公公",
    relationMotherInLaw: "岳母/婆婆",
    relationParentInLaw: "岳父母/公婆",
    relationBrotherInLaw: "姐夫/妹夫",
    relationSisterInLaw: "嫂子/弟媳",
    relationSiblingInLaw: "姻亲",
    relationUncle: "叔伯/舅舅",
    relationAunt: "姑姑/阿姨",
    relationAuntUncle: "叔伯姑姨",
    relationCousin: "堂/表亲",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

interface I18nContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

interface I18nProviderProps {
  children: ReactNode;
  /** Override the initial language (bypasses auto-detection) */
  initialLanguage?: Language;
}

export function I18nProvider({ children, initialLanguage }: I18nProviderProps) {
  const [lang, setLang] = useState<Language>(initialLanguage ?? "zh");
  const [isInitialized, setIsInitialized] = useState(!!initialLanguage);

  // Detect language on client-side if not explicitly provided
  useEffect(() => {
    if (!initialLanguage && !isInitialized) {
      const detected = detectLanguage();
      setLang(detected);
      setIsInitialized(true);
    }
  }, [initialLanguage, isInitialized]);

  const t = useCallback(
    (key: TranslationKey): string => {
      return translations[lang][key] || translations.en[key] || key;
    },
    [lang]
  );

  // Memoize the context value to prevent unnecessary re-renders of consumers
  const value = useMemo(
    () => ({ lang, setLang, t }),
    [lang, t]
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}

export function LanguageToggle() {
  const { lang, setLang } = useI18n();

  return (
    <div className="flex items-center bg-gray-100 rounded-full p-0.5">
      <button
        onClick={() => setLang("en")}
        className={`px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-medium rounded-full transition-all ${
          lang === "en"
            ? "bg-white text-gray-800 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLang("zh")}
        className={`px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-medium rounded-full transition-all ${
          lang === "zh"
            ? "bg-white text-gray-800 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        中文
      </button>
    </div>
  );
}

/**
 * Compact language toggle pill for mobile interfaces.
 * Can be used standalone (with local state) or with I18nProvider context.
 */
interface MobileLanguageToggleProps {
  /** Current language (for standalone use) */
  language?: Language;
  /** Callback when language changes (for standalone use) */
  onLanguageChange?: (lang: Language) => void;
}

export function MobileLanguageToggle({ language, onLanguageChange }: MobileLanguageToggleProps) {
  // Try to use context, fall back to props
  let lang: Language;
  let setLang: (l: Language) => void;

  try {
    const context = useContext(I18nContext);
    if (context && !language) {
      lang = context.lang;
      setLang = context.setLang;
    } else {
      lang = language ?? "zh";
      setLang = onLanguageChange ?? (() => {});
    }
  } catch {
    lang = language ?? "zh";
    setLang = onLanguageChange ?? (() => {});
  }

  return (
    <button
      onClick={() => setLang(lang === "en" ? "zh" : "en")}
      className="flex items-center bg-amber-100/80 hover:bg-amber-200/80 active:bg-amber-300/80 rounded-full px-2 py-1 transition-colors"
      aria-label={`Switch to ${lang === "en" ? "Chinese" : "English"}`}
    >
      <span
        className={`text-xs font-medium transition-colors ${
          lang === "en" ? "text-amber-800" : "text-amber-500"
        }`}
      >
        EN
      </span>
      <span className="text-amber-400 mx-0.5">/</span>
      <span
        className={`text-xs font-medium transition-colors ${
          lang === "zh" ? "text-amber-800" : "text-amber-500"
        }`}
      >
        中
      </span>
    </button>
  );
}

// Export detectLanguage for components that manage their own state
export { detectLanguage };
