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
