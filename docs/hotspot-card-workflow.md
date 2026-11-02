# أخطاء استجابة الحفظ والباكند

- قراءة JSON المشتركة تتحقق من الاستجابة قبل استخدامها، وتحول ردود البروكسي النصية أو HTML إلى رسالة عربية بدل Unexpected token.
- لا تظهر نتيجة نجاح ولا تستبدل المكتبة المحلية عند الاستجابة غير المكتملة. يبقى التصميم في المحرر. لا إعادة إرسال تلقائية لطلبات الحفظ أو تأكيد الطباعة، لتجنب تكرار عملية ربما وصلت للخادم.
- فشل الحفظ غير المتوقع في الباكند يسجل الوسم `[hotspot-card-templates]` ورمزًا محدودًا فقط، دون SQL أو كلمات مرور أو بيانات القالب. أخطاء اتصال Next بالبـاكند تبقى في سجل Next.
- الخطأ النصي وحده لا يحدد سبب تعطل الباكند؛ يلزم سجل الخادم إذا استمر بعد إعادة تشغيل الواجهة والباكند. لا تغيير للحدود أو المنافذ أو قاعدة البيانات بناءً على التخمين.

# ما بعد حفظ القالب

- تظهر نتيجة النجاح بعد استجابة الحفظ الناجحة فقط، مع اسم القالب وتمييز حفظ المسودة عن الحفظ والاعتماد.
- يختار المستخدم متابعة التصميم أو «مراجعة الحزم وطباعتها» للانتقال لقائمة حزم الشبكة نفسها. لا طباعة تلقائية ولا إنشاء حزمة أو تغيير ربط الباقة تلقائيًا.
- حفظ المسودة يوضح ضرورة اعتماد التغييرات قبل استخدامها في الطباعة؛ فشل الحفظ يبقى رسالة خطأ ولا يعرض نجاحًا.

# نافذة اختيار القالب البصرية

- حقل القالب المحفوظ في البداية وداخل المحرر يفتح نافذة مشتركة بدل القائمة المنسدلة: بحث بالاسم، معاينات مصغرة، تمييز المختار، وحالة المسودة/الاعتماد والقالب الافتراضي.
- المعاينات تستخدم محرك العرض نفسه ببيانات تجريبية فقط. لا توليد QR لحسابات حقيقية ولا طلبات شبكة إضافية؛ حجم الصور يتكيف مع النافذة دون تغيير أبعاد القالب.
- تصفح القوالب وتحديدها لا يغير المحرر. «استخدام القالب» يطبق الاختيار، والإلغاء يحافظ عليه. يبقى القالب المفتوح في مكانه عند اختياره مرة أخرى من داخل المحرر.
- «تصميم جديد» و«استيراد قالب» يفتحان المسارين الحاليين، مع حد القوالب نفسه. لا حفظ أو اعتماد تلقائي ولا تعديل على قالب الباقة عند الاختيار.
- التعديل لا يحتاج SQL أو إعادة تشغيل الباكند.

# رابط الشبكة الذي يدخله المستخدم

- رابط QR إعداد في القالب يكتبه المستخدم بحسب شبكته، دون قيمة ثابتة أو افتراضية لنطاق محدد.
- التوجيه موحد في إدراج QR وخيارات الطباعة: رابط أساسي كامل مع http/https، دون متغيرات Labeljoy أو username/password.
- روابط Labeljoy التي تحتوي بيانات الدخول تظهر رسالة خاصة تطلب الرابط الأساسي؛ لا يتم تجاهلها أو استبدالها صامتًا. بيانات كل بطاقة تضاف بواسطة URLSearchParams مع ترميزها، والرمز الواحد يستخدم في الحقلين.
- تصحيح حقل الرابط يزيل إشعار الخطأ السابق، ويستمر التحقق المباشر قبل الطباعة. لا تغييرات قاعدة بيانات أو خدمات.

# التحقق من رابط QR في الطباعة التجريبية

- التحقق المركزي يلتقط أخطاء URL الأصلية ويعرض توجيهًا عربيًا ثابتًا دون كشف الرابط أو بيانات المستخدم.
- عند تفعيل QR يظهر حقل رابط الهوتسبوت داخل خيارات الطباعة نفسها، مع مثال لصيغة كاملة وتحقق مباشر. الضغط على الطباعة أو PDF عند خطأ ينقل التركيز للحقل قبل بدء التجهيز.
- لا يستبدل النظام رابط الدخول برابط افتراضي أو QR تجريبي مضلل؛ يُدخل المستخدم عنوان الهوتسبوت الفعلي. القوالب دون QR لا تحتاج رابطًا.

# هوية حزم البطاقات ومعيار الطباعة الكاملة

- الحزمة كيان تجميع البطاقات ولها ID موجود أصلًا؛ الباقة تظل تعريف الخدمة. لا إعادة تسمية للجداول أو المسارات ولا نقل للبيانات.
- ID الحزمة بنفسجي إن لم يبدأ استخدام أي بطاقة، أزرق عند بدء بعضها، وأخضر عند بدء جميعها. الشارة والحالة ونسبة الاستخدام في التفاصيل تستخدم الألوان نفسها.
- الملخص يعرض العدد الإجمالي، من بدأ استخدامها ومن لم يبدأ، اسم الباقة ونوع المدة، تاريخ الإنشاء والمنشئ وأول استخدام فعلي، والقيمة الاسمية المحسوبة بدقة SQL. القيمة الاسمية ليست إيرادًا محصلًا.
- البحث بالاسم أو ID، وتصفية بدء الاستخدام على الخادم. العدادات تعتمد تفعيل أي فترة خدمة للبطاقة؛ لا تعني اتصالًا حيًا ولا استهلاك الصلاحية بالكامل.
- الضغط على عداد المستخدمة أو غير المستخدمة يفتح بطاقات الحزمة بالتصفية المناسبة. سجل آخر 50 عملية يحمّل فقط عند فتحه، بعد تحقق ملكية الحزمة.
- الطباعة وPDF للحزمة كاملة فقط. حذفت واجهة النطاق والاختيار الفردي؛ الخادم يقارن الأرقام بكل بطاقات الحزمة داخل قفل المعاملة ويرفض التأكيد الجزئي حتى من عميل قديم.
- الطباعة: لم تُطبع/طُبعت بالكامل. تأكيد المستخدم مطلوب؛ إغلاق نافذة النظام لا يثبت النجاح. PDF مستقل، وإعادة الطباعة الكاملة متاحة مع تنويه.
- لا SQL جديد لهذا التحديث؛ تتبع الطباعة يعتمد ترقية 20261102_hotspot_print_tracking.sql السابقة. لا استدعاءات NAS ولا تعديل على الحسابات أو المحاسبة.

# تحسين العرض الدائري للبطاقات والصفوف

- شارة المعرّف في يمين البطاقة، والحالة أسفلها، مقابل اسم المستخدم. يبدأ عرض الصفوف بالمعرّف والحالة أيضًا.
- العرض الأساسي يستخدم دائرتين متجاورتين: حجم مستهلك/متبقٍ بترميز لوني واضح، والوقت المتبقي. الصفوف تستخدم نسختين مصغرتين من المؤشرات نفسها، والتفاصيل تعرض دوائر أكبر.
- التلميحات المشتركة توضح القيم الفعلية عند المرور أو التركيز. غير المحدود يظهر ∞، وما لم يبدأ يظهر — مع التوضيح، دون نسب وهمية.
- امتداد اختياري لمكون CircularProgress المشترك: أحجام xs/sm/md، نص مركزي، لون المسار ولون معلومات. السلوك والمظهر الافتراضيان لبقية الصفحات محفوظان.
- أيقونات خيارات التصفية والترتيب ملونة بحسب دلالتها، دون مربعات حولها. لا تغيرات على المحاسبة أو SQL أو الشبكة.

# مؤشرات الاستهلاك والتصفية وتأكيد الطباعة

- مؤشرات الحجم تعرض المستخدم والمتبقي ونسبهما؛ التفاصيل تعرض دائرتين للحجم والوقت المتبقي. الحسابات دون فترة خدمة تعرض «غير محدد»، والحجم غير المحدود لا يعرض نسبة وهمية.
- الوقت المتواصل يحسب من التفعيل والانتهاء مع ساعة الخادم وتصحيح فرق ساعة المتصفح؛ تحديث محلي كل 30 ثانية دون طلب شبكي. وقت الاستخدام يعرض الرصيد حسب آخر محاسبة، ولا يفترض اتصالًا حيًا أو يخصم وقتًا محليًا.
- مجموعات التصفية بأيقونات دون مربعات: الباقة/الحزمة، الحالة، الحجم، الوقت، مع شرائح إزالة ومسح الكل. قرب نفاد الحجم: 80% فأكثر وأقل من 100%. قرب انتهاء المتواصل: 24 ساعة أو أقل، ووقت الاستخدام: 20% أو أقل. التصفية تتم على الخادم.
- نفّذ `src/app/backend/tenant-upgrades/20261102_hotspot_print_tracking.sql` على قاعدة الشبكة الحالية. الترقية تضيف جدولي وظائف إخراج وعلامات طباعة، دون تغيير الحسابات أو بياناتها. القالب الكامل لقواعد الشبكات الجديدة يتضمنهما أيضًا.
- لا يسجل فتح نافذة الطباعة أو إغلاقها نجاحًا. يؤكد المستخدم اكتمال كل بطاقات الحزمة، ويحدد النتيجة الفعلية: طباعة ورقية أو حفظ PDF. الإلغاء لا يغير حالة الطباعة.
- حالتا الطباعة: لم تُطبع/طُبعت بالكامل بعد تأكيد طباعة جميع بطاقات الحزمة. إعادة الطباعة لا تضاعف العدد. PDF مستقل ولا يضع علامات طباعة ورقية.
- التأكيد يتحقق من ملكية الحزمة وأرقام بطاقاتها على الخادم. قفل الحزمة ومعرّف طلب ثابت يمنعان تكرار العلامات وأحداث اللوغ عند إعادة إرسال التأكيد. تحفظ العملية والعلامات واللوغ في معاملة واحدة. لا تحفظ كلمات مرور أو روابط QR في سجل العملية.
- عند غياب الترقية تستمر قراءة البطاقات، وتظهر حالة التتبع «غير مفعّل» بدل الادعاء بأن الحزمة لم تطبع. محاولة حفظ تأكيد تعرض اسم الترقية المطلوبة.
- تختار الطابعة أو Save as PDF داخل نافذة النظام؛ لا توجد وسيلة لإثبات خروج الورق أو حفظ الملف آليًا. سجل الإخراج قائم على تأكيد المستخدم.

# عرض الحزم والبطاقات

- العرض والبحث والتصفية يستخدم CollectionToolbar وCollectionCard/Table مع بديل للهاتف، ومفاتيح عرض محفوظة حسب الشبكة.
- فلاتر الحزم: الباقة وطريقة الدخول ومجانية/مدفوعة. ترتيب بالاسم أو الإنشاء أو العدد؛ 50 أو 100 أو 150 عنصرًا في الصفحة.
- يحسب الخادم توزيع حالات كل حزمة على كامل بطاقاتها، للحزم الظاهرة فقط. شريط مقسّم بألوان الحالات، ودائرة نسبة البطاقات التي بدأ استخدامها داخل تفاصيل الحزمة.
- حالات الحزمة التفاعلية تصفّي بطاقاتها؛ ألوان الحالة ومعرّف البطاقة من تعريف مشترك. البحث والترتيب والاستهلاك والانتهاء على الخادم بصفحات مستقلة.
- تبقى قائمة الحزم مركبة أثناء فتح التفاصيل لحفظ البحث والفلاتر والصفحة والتحديد؛ يعاد موضع التمرير عند الرجوع.
- CSV يشمل الحزمة؛ معاينة الطباعة وPDF يشملان الحزمة كاملة فقط؛ لا اختيار نطاق أو بطاقات محددة.
- لا استدعاءات NAS API ولا تعديلات على المصادقة أو المحاسبة. تتبع الطباعة يحتاج ترقية SQL المذكورة أدناه.

# مسار تصميم بطاقات الهوتسبوت

## البداية

اختر «استيراد قالب جاهز» أو «تصميم من خلال الراديوس». كل مسار ينشئ مسودة جديدة؛ يمكن بدلًا من ذلك اختيار قالب محفوظ ومتابعة تعديله.

1. حدد A4 أو A5 وعدد البطاقات في الورقة والهوامش والمسافات. يحسب النظام عرض وارتفاع البطاقة ويحفظهما مع التوزيع. في الاستيراد تظهر أبعاد الصورة المقترحة بدقة 300 DPI.
2. اختر باقة للمعاينة لتتحدد طريقة الدخول، ثم أضف المتغيرات التي تريدها فقط بالسحب والإفلات. يمكن تصميم خلفية بلون موحد أو بتدرج لونين واتجاه محدد. تعرض المتغيرات القيم فقط افتراضيًا؛ مثل `hs123456` دون عبارة «رمز الدخول». المسميات خيار إضافي.
3. راجع توزيع الورقة كاملة ببيانات تجريبية، ثم احفظ المسودة أو اعتمدها للطباعة. طباعة الحزم تستخدم بيانات الحسابات الحقيقية والتوزيع المحفوظ، وتقسمها إلى أوراق بعدد البطاقات المعتمد.

## التواصل والقوالب الجاهزة

- اختر حتى ستة أرقام من الأرقام الموجودة في إعدادات تواصل الشبكة، ثم أضف متغير «أرقام التواصل». لا تكتب الأرقام يدويًا داخل القالب.
- تغيير أرقام الشبكة ينعكس في الطباعة الجديدة؛ الأرقام المحذوفة لا تظهر حتى لو كانت مختارة في قالب قديم.
- للقالب الجاهز صمّم الصورة بنفس نسبة عرض البطاقة إلى ارتفاعها، ويفضل المقاس المقترح عند 300 DPI. اترك نحو 3 مم بعيدًا عن الحواف للمحتوى المهم، ولا تضع بيانات دخول حسابات ثابتة داخل الصورة.
- القالب المستورد لا يضيف حجم باقة أو سعرًا أو بيانات دخول تلقائيًا. أضف ما تحتاجه من قائمة المتغيرات.
- المعاينة والطباعة تستخدمان المحرك نفسه، لكن يجب تجربة ورقة واحدة ومراجعة إعدادات الطابعة قبل طباعة حزمة كبيرة.

لا يحتاج التعديل ترقية SQL جديدة؛ التوزيع والألوان واختيارات التواصل تحفظ في JSON القالب الحالي. الواجهة والخلفية تحتاجان إعادة تشغيل بعد السحب.

## Field-oriented imported artwork editor

The imported-card workflow uses a fixed single-card background and locally bound Radius fields. The field panel shows a sample value and marks fields already present. Dragging a field places its value; the label remains editor guidance unless explicitly enabled in the design. Account login mode still comes from the package.

Editor-only zoom (75–200%), a 5 mm grid and optional 1 mm snapping help position fields. Position and width inputs display physical millimetres and convert to the existing normalized positions on save. These tools do not change print dimensions or add API/database polling. Grid, zoom and snapping are not part of exported/printed artwork.

Import a single-card PNG/JPEG/WebP background, not a whole sheet or a Labeljoy native project. Export external artwork without dynamic credentials. Radius JSON remains the supported editable design interchange. Print geometry and the final sheet preview remain shared with the established workflow.

Reference workflow: Labeljoy 6 official field panel, layout wizard and image-export documentation:
- https://www.labeljoy.com/help-lj6/the-field-panel/
- https://www.labeljoy.com/help-lj6/layout-wizard/
- https://www.labeljoy.com/help-lj6/exporting-labels/

## Single-page imported-template ribbon

The imported-template path opens one editor rather than the separate sheet/elements/approval stages. A top ribbon groups File (artwork, JSON, template name, package binding), Insert (fields, logo, text and configured contacts), Format (selected field styling and position), and Page layout (paper distribution and print-size guidance). All controls stay above the shared card canvas. Selecting a field on the card opens Format after pointer release, preserving drag coordinates during the gesture.

Sheet preview toggles within the same page; draft save and approval stay in the editor header. The internal design path keeps its established stages. The renderer, print dimensions, revision checks, credential policy and approved-template behavior are unchanged. No schema changes.

## Live sheet canvas

Imported artwork now opens directly as an editable A4/A5 sheet with the configured rows, columns, card size, margins and gaps. For example, the ten-card layout renders exactly two columns and five rows. Drag-and-drop resolves the specific card under the pointer, and converts its local coordinates into shared template positions. Every card updates immediately from that single design; the editor never writes account data. Dropping in paper margins or gaps does nothing.

The initial scale fits both the available width and a viewport-relative height, with explicit zoom available for detail editing. Grid overlays, selection outlines and editor zoom stay outside the print path. QR preview is generated once and reused across the sheet. Ribbon tabs and field icons use distinct semantic colors without icon background boxes. The separate read-only sheet-preview toggle is replaced by this always-visible live sheet.

## Focused card editing and design history

The live sheet remains the default. Double-click a card, or select it and choose Enlarge card, to edit the shared template at a larger scale. Return to the sheet to inspect all cards. Focus mode changes only the editor view, never the saved sheet layout or print size. Insert fields remain visible; logo, text and contact options are behind an optional details control. Exact position/size inputs are also optional, while basic text formatting is shown for the selected field. QR URL settings appear when QR is selected.

Design undo/redo is scoped to the current template and limited to 40 immutable snapshots, sharing image strings. One complete pointer drag is one history step. Repeated edits of the same property within 700 ms coalesce; a fresh edit after undo clears redo. Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y are supported on the editor surface. Inputs keep native text undo. History is local to the editing session, clears on template switch/reload and never changes the approved template or credentials by itself. Approval remains explicit. Template names, default selection and package bindings are outside design history. No API requests occur during editing, undo or focus changes.

## Editor viewport layout

The imported editor measures available space above the shared footer and reserves a persistent flex viewport for the canvas. Ribbon tabs and view controls are compact, with a stable-height options area so changing tabs cannot push the sheet down. Optional overflowing settings scroll within the tools area; zoomed artwork scrolls within the canvas. Base fit scale uses the canvas's actual observed width and height, rather than a fraction of the whole browser window.

The field palette appears first in Insert, before optional artwork/contact settings. Basic selected-field typography, color, visibility and the exact-position toggle share a compact row. The default fit view keeps tools and artwork visible together. No print dimensions, data or backend behavior change.

## Sidebar workspace

The imported editor now uses an RTL three-part workspace: a narrow category rail on the right, a fixed-width adjacent options panel, and the live canvas on the left. Switching categories preserves panel width and canvas space. Explicit collapse expands the canvas; choosing a category or selecting a field reopens the relevant options. The undo/redo, focus, zoom, grid and snap controls stay in a compact top toolbar; save/approval remain in the editor header.

Options scroll independently. At smaller breakpoints the rail becomes horizontal and the options panel is height-limited and collapsible above the canvas. Sheet settings have a compact single-column variant for the sidebar. Shared print layout, draft history, account data and the renderer are unchanged.

## Guided imported workflow and compact heading

The imported designer guides the user through source selection, paper distribution, then editing. The first step previews one card; the second shows the configured sheet. Editing and approval unlock after selecting a source, template name and package with a defined login mode, and explicitly proceeding from the distribution step. Returning through steps keeps the draft. The category rail reflects this progression; typography opens when a field is selected in the editing step.

A single compact header contains the template name, current step, back and save actions. The template hub omits its duplicate navigation row for this designer; hub navigation is available from the designer landing view. Print bindings, default template, cloning and export are grouped under optional printing options. Margins and gaps are optional details in the guided paper step. The live canvas stays inside the measured viewport above the shared footer; tools scroll independently. No schema, account or NAS behavior changes.

## Saved-template selection routing fix

Selecting a saved template no longer derives the editor route from whether its background image exists. Selection inside the guided sidebar preserves that workspace. Opening a saved template from the landing view also uses the guided sidebar for both image-backed and native designs. Saved designs and locally imported sources count as valid sources even without a background image, so the distribution step remains available. Switching templates resets the guided progression without deleting either draft. Explicitly starting a new native design retains its separate creation route. No account or backend changes.

## Consistent action and element controls

Header back, draft-save and approve actions use the shared button component with a consistent 40px height, rounded rectangular corners and bare icons. The preview toolbar groups undo/redo, explicit sheet/card view actions, fit/zoom, grid and snapping. Typography is a labeled two-column group; physical position/size uses three short labels with LTR numeric inputs. Label/layout/reset settings are optional details. Insertion fields are grouped into login data, package data and network information.

A shared size guide derives physical dimensions and 300 DPI image dimensions from the actual saved sheet geometry, in both paper setup and the editing sidebar. It updates with paper, card count, margins and gaps; guidance is never a hard-coded card size. Print rendering and approval behavior are preserved.

## Native design and system print destinations

Both new native designs and imported artwork use the guided sidebar flow. Native design starts with preset previews and a populated editable card. Six appearance presets set the existing gradient/color properties; the Appearance section allows solid/gradient fills, gradient direction, frame and text color, base font and alignment. Applying a preset recolors existing per-element styles while retaining their sizes and positions. No design schema or SQL change is needed. The old full-page native creation route is removed.

The designer offers a clearly labeled one-sheet test print/PDF with fake credentials. Real batch/standalone output continues to use approved templates and actual account data. Both output buttons open the browser/system print dialog: choose a printer for physical output, or Save as PDF as the destination. They do not silently select a printer or automatically download a PDF. Physical layout, QR preparation and overflow checks use the shared print function; its optional escaped title improves suggested PDF naming.

## Structured native card artwork

Native designs now opt into an identity-inspired visual structure rather than only a flat gradient: Identity, Soft wave and Geometric corners, plus a plain canvas option. These use local SVG decoration, an inset edge, brand divider and distinct credential/metadata surfaces. They retain editable field positions, colors and values-only behavior. Rounded/straight corners and an explicit reset-to-style arrangement are available. Color presets are independent of structure.

`cardStyle` and `cornerStyle` are optional, validated design JSON attributes in frontend import and backend normalization. Existing designs without them retain their previous rendering and positions. Image-backed designs bypass the native artwork decoration. New native designs default to Identity. Preview and printing share the same renderer; no images are remotely loaded and no SQL migration is needed.

## Contact captions and font selection

Each configured contact number can have a template-local caption override, with an independent show-captions toggle. The network's primary-phone designation and the saved phone number are not changed. Overrides are escaped when rendered, limited to six captions of 60 characters, restricted to configured contact numbers on save, and pruned when a contact disappears. Values-only output remains the default unless captions are enabled.

The design and individual text elements support a fixed font allowlist: LBC, Tahoma, Arial, Times New Roman and Courier New. The shared renderer uses the same explicit stack in preview and the print iframe. These are device-local fonts with defined fallbacks; no remote font URLs or downloads are introduced. New native cards default to the project's LBC stack. Optional JSON fields preserve old template output; no SQL migration is needed.

## Position locks, alignment and scan-to-login

Position/size locks persist as a validated `locked` field-key list in the design JSON. Locked nodes can be selected and unlocked, but cannot be dragged, resized, hidden or moved by arrow keys. The all-fields clear action is disabled while locks exist, and bulk position resets preserve frozen positions. Font/color changes remain available. Smart alignment uses card-center and other visible elements' edges/centers, calculated locally at gesture start, with a 0.65mm attraction threshold. A toggleable 3mm safety outline and transient alignment lines exist only in the editor HTML, never print output.

The QR URL already encodes the actual account username and password (single code uses the same value for both). PAP can receive plain credentials; CHAP requires the router's current challenge and md5.js. The downloadable `public/hotspot/qr-login.html` is intended to be installed as login.html in the router's existing Hotspot HTML directory, retaining md5.js. It reads QR parameters, removes them from the visible URL, and submits the router login form automatically, hashing with the CHAP challenge when supplied. It falls back to a manual form on errors; it does not declare success before router authentication. Phone must be on the Hotspot network. Existing custom login pages may instead implement this behavior themselves. No files are automatically installed on a NAS, no password is sent to a QR provider, and no authentication method is changed.

Official RouterOS reference: https://help.mikrotik.com/docs/spaces/ROS/pages/87162881/Hotspot%20customisation

## QR size interaction

Selecting an unlocked QR exposes an editor-only bottom-right resize handle. The diagonal gesture changes square side length in card-local coordinates, accounting for fit/zoom and repeated-sheet selection. One resize gesture is one undo step. A labeled millimetre size input provides precise sizing; the square is bounded to card width/height and its position is clamped to keep it inside the card. Locked QR nodes cannot resize.

The white quiet zone remains part of the locally generated SVG and scales with it. Sizes below 16mm show an editor warning; the existing print-time minimum guard remains in place. Handles and guides are never included in print HTML. No QR data, login flow or database schema changes.

## Review, crop marks and activity log

Approval runs a local preflight against the actual rendered card after images/fonts are ready. It detects bounds errors, QR below 16mm, likely overlaps, content outside the 3mm safe area, small text and hidden login details. Error-level issues block approval; warnings can be reviewed and explicitly accepted. Clicking an element issue selects that field. Draft saving remains independent. Review does not inspect text baked into an imported image, and does not replace a physical test sheet.

Optional crop marks are stored in existing design JSON and can be overridden for a single batch print. They appear outside card boundaries in sheet preview and physical/PDF output, without changing the card dimensions. At least 2mm gaps are required. The print grid has an explicit physical width for stable mark coordinates.

Successful template creation, draft edits and approval append named tenant activity events using the shared audit helper inside the same transaction as the library save. Unchanged saves add no duplicate template events. New templates created and approved together produce both events. Metadata contains only template ID/name, revision and approval state; no credentials, QR URL, artwork or contact content is logged. The activity UI shows Arabic names and the template name. No new SQL tables or migration are needed.
# قائمة البطاقات وفحص بطاقة

- ضمن الهوتسبوت: «الحزم والبطاقات» تبدأ بقائمة الحزم، ثم تفتح بطاقات الحزمة المحددة. الحسابات الفردية تبقى في تبويبها المستقل.
- «فحص بطاقة» يبحث بالرمز أو اسم المستخدم المطابق عبر طلب POST دون كلمات المرور، ويعرض الباقة والحزمة وحالة الاشتراك والاستهلاك والمتبقي وأوقات التفعيل والانتهاء وآخر تحديث للمحاسبة.
- القراءة لمدير الشبكة الرئيسي فقط، ومن قاعدة الشبكة الحالية. لا تستدعي RouterOS API ولا تعدل حالة الحساب أو الاشتراك ولا تحتاج ترقية SQL.
- الحالة مشتقة من إيقاف الحساب وفترة الخدمة الحالية/الأخيرة والحجم والوقت المستهلك؛ «سارية» ليست دليل اتصال مباشر. الاستهلاك حسب آخر تحديث محاسبة.
- بيانات الطباعة وحالة إتمام الطباعة لم تتغير بهذا التحديث.

