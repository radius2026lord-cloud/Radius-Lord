# مسار تصميم بطاقات الهوتسبوت

## البداية

اختر «استيراد قالب جاهز» أو «تصميم من خلال الراديوس». كل مسار ينشئ مسودة جديدة؛ يمكن بدلًا من ذلك اختيار قالب محفوظ ومتابعة تعديله.

1. حدد A4 أو A5 وعدد البطاقات في الورقة والهوامش والمسافات. يحسب النظام عرض وارتفاع البطاقة ويحفظهما مع التوزيع. في الاستيراد تظهر أبعاد الصورة المقترحة بدقة 300 DPI.
2. اختر باقة للمعاينة لتتحدد طريقة الدخول، ثم أضف المتغيرات التي تريدها فقط بالسحب والإفلات. يمكن تصميم خلفية بلون موحد أو بتدرج لونين واتجاه محدد. تعرض المتغيرات القيم فقط افتراضيًا؛ مثل `hs123456` دون عبارة «رمز الدخول». المسميات خيار إضافي.
3. راجع توزيع الورقة كاملة ببيانات تجريبية، ثم احفظ المسودة أو اعتمدها للطباعة. طباعة الدفعات تستخدم بيانات الحسابات الحقيقية والتوزيع المحفوظ، وتقسمها إلى أوراق بعدد البطاقات المعتمد.

## التواصل والقوالب الجاهزة

- اختر حتى ستة أرقام من الأرقام الموجودة في إعدادات تواصل الشبكة، ثم أضف متغير «أرقام التواصل». لا تكتب الأرقام يدويًا داخل القالب.
- تغيير أرقام الشبكة ينعكس في الطباعة الجديدة؛ الأرقام المحذوفة لا تظهر حتى لو كانت مختارة في قالب قديم.
- للقالب الجاهز صمّم الصورة بنفس نسبة عرض البطاقة إلى ارتفاعها، ويفضل المقاس المقترح عند 300 DPI. اترك نحو 3 مم بعيدًا عن الحواف للمحتوى المهم، ولا تضع بيانات دخول حسابات ثابتة داخل الصورة.
- القالب المستورد لا يضيف حجم باقة أو سعرًا أو بيانات دخول تلقائيًا. أضف ما تحتاجه من قائمة المتغيرات.
- المعاينة والطباعة تستخدمان المحرك نفسه، لكن يجب تجربة ورقة واحدة ومراجعة إعدادات الطابعة قبل طباعة دفعة كبيرة.

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
