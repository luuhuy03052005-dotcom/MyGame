# Phân tích plan AI cho Coastlet Builder

## Kết luận điều hành

Tao **không khuyến nghị confirm “bắt đầu Phase 0 ngay” theo kiểu vô điều kiện**. Đánh giá đúng hơn là **go có điều kiện**: phần lớn hướng kỹ thuật đang đi đúng đường, nhưng bộ tài liệu hiện tại vẫn còn vài chỗ tự đấm nhau bằng gậy bóng chày — đặc biệt ở **tính tất định của rule engine**, **flow Vite dev/prod**, **đồng bộ trạng thái tài liệu**, và **security hardening của Electron trong Phase 0**. Nếu không sửa mấy điểm này trước khi scaffold, mày sẽ dựng khung trên spec còn lệch, tới lúc code lên mới phát hiện “ủa sao tài liệu đá nhau” là lại mất công đập đi xây lại. fileciteturn1file1 fileciteturn1file3 fileciteturn1file4 fileciteturn1file5

Về mặt nền tảng, hướng mà AI đang chọn là **hợp lý**: Electron dùng `main`/`renderer`/`preload`, preload bridge qua `contextBridge`, `nodeIntegration: false`, `contextIsolation: true`, và `sandbox: true` là đúng bài theo docs chính thức. Electron cũng xác nhận `app.isPackaged` có thể dùng để tách dev/prod, `loadURL()` dùng cho dev server, còn `loadFile()` dùng cho HTML local trong production. Nhưng để production load bằng `loadFile()` an toàn với Vite, mày phải chốt luôn chiến lược asset path; Vite mặc định `base: '/'`, còn embedded deployment bằng file local thì nên dùng `base: './'` hoặc `''`, nếu không đường dẫn asset rất dễ trật bánh trong build packaged. citeturn7view0turn7view1turn7view2turn1view2turn1view1turn7view3turn7view4turn10view0turn10view1

Nói ngắn gọn: **AI chưa sai hướng, nhưng chưa đủ sạch để được “auto-confirm”**. Cần một vòng cleanup tài liệu rất ngắn trước khi cho nó scaffold `package.json`, `vite.config.js`, `main.js`, `preload.js` và cây thư mục Phase 0. fileciteturn1file4 fileciteturn1file5

## Kiểm định từng tuyên bố trong plan

Bảng dưới đây đối chiếu trực tiếp 5 tuyên bố “đã hoàn thành” với các file hiện có trong lượt này: `CONVENTIONS.md`, `DATA_MODELS.md`, `RULES_REFERENCE.md`, `TASKS.md`, `implementation_plan.md`, `project_overview.md` và `deep-research-report.md`. fileciteturn1file0 fileciteturn1file1 fileciteturn1file2 fileciteturn1file3 fileciteturn1file4 fileciteturn1file5 fileciteturn1file6

| Tuyên bố của AI | Đánh giá | Nhận định |
|---|---|---|
| Đã đọc `deep-research-report.md` và không conflict | **Đúng một phần** | File report có mặt và nội dung định hướng đúng, nhưng `implementation_plan.md` hiện vẫn còn ghi `deep-research-report.md` là “✅ Có (chưa đọc)” và 3 file còn thiếu là “chưa tạo”, nên ít nhất tài liệu trạng thái **chưa được cập nhật đồng bộ**. Phần “không conflict với AGENTS.md/ARCHITECTURE.md” hiện **chưa kiểm chứng đầy đủ** vì nội dung hai file đó không nằm trong bộ tệp mày cung cấp để đối chiếu trực tiếp ở lượt này. |
| Đã tạo `CONVENTIONS.md`, `DATA_MODELS.md`, `RULES_REFERENCE.md` | **Đúng** | Ba file này thực sự đã có và nội dung khá cụ thể: naming, error handling, IPC, schema `x/y/z`, save JSON, rules foundation/wall/roof/bridge. |
| Đã fix lỗi tọa độ `q/r/h` → `x/y/z` | **Đúng** | `DATA_MODELS.md` cấm hẳn `q/r` cho project này và định nghĩa square grid `x/y/z`; `project_overview.md` cũng dùng `Map<"x_y_z", Cell>` và flow build theo `x, y, z`. |
| Đã fix save schema: bỏ `randomSeed`, bỏ `colorKey`, dùng `color: "#hex"` | **Đúng nhưng kéo theo bug thiết kế mới** | Save schema hiện đúng như AI nói, nhưng `RULES_REFERENCE.md` lại dùng `Math.random() < 0.4` cho `wall_window`, nghĩa là behavior procedural **không còn deterministic**, trái với tinh thần “không cần randomSeed” và làm save/load + test dễ lệch kết quả. |
| Đã confirm Vite dev/prod loading | **Đúng một phần** | Về kỹ thuật Electron, dùng `app.isPackaged` để tách `loadURL('http://localhost:5173')` ở dev và `loadFile(...)` ở prod là hoàn toàn hợp lệ. Nhưng `implementation_plan.md` vẫn tự mâu thuẫn: một đoạn nói renderer “không phải localhost”, đoạn khác lại nói `localhost:5173` khi dev; đồng thời plan chưa ghi rõ cấu hình Vite `base: './'` cho production local-file embedding. |

## Các mâu thuẫn và blocker cần sửa trước khi confirm

### Tài liệu trạng thái đang lệch nhau

Điểm đỏ đầu tiên là **`implementation_plan.md` không phản ánh trạng thái mà AI vừa tuyên bố**. Trong file đó, mục “Trạng thái hiện tại” vẫn nói `deep-research-report.md` “chưa đọc” và ba file `CONVENTIONS.md`, `DATA_MODELS.md`, `RULES_REFERENCE.md` “chưa tạo”, trong khi thực tế các file đã có và AI đang báo là đã hoàn thành cả 5 bước. Cái này không phải lỗi “trình bày cho vui”; nó là lỗi quản trị cấu hình. Để agent code bám vào một file trạng thái stale thì kiểu gì cũng có ngày nó đọc nhầm rồi đi sai phase. fileciteturn1file5

Khuyến nghị: sửa ngay `implementation_plan.md` để trạng thái dự án phản ánh đúng hiện tại. Nếu không, câu “sẵn sàng bắt đầu Phase 0” chưa đáng tin ở góc độ kiến trúc vì **nguồn sự thật đang bị chia đôi**. fileciteturn1file5

### Rule engine đang tự mâu thuẫn về tính tất định

`DATA_MODELS.md` ghi rất rõ: **MVP không có `randomSeed`** vì **rule engine deterministic**. Nhưng `RULES_REFERENCE.md` lại cài `wall_window` theo điều kiện `Math.random() < 0.4`. Hai thứ này cắn nhau trực diện. Nếu giữ `Math.random()`, thì cùng một world logic có thể resolve ra façade khác nhau giữa các lần load, giữa test run, hoặc giữa máy dev và máy QA; như vậy save file chỉ lưu `assetType` ở thời điểm save sẽ không còn đồng nhất với policy “derived visuals regenerate from logic” mà deep report đã khuyến nghị. fileciteturn1file1 fileciteturn1file3 fileciteturn1file2

Cách sửa gọn nhất cho MVP là bỏ random runtime và thay bằng **deterministic hash theo cell id hoặc tọa độ**. Ví dụ, thay vì `Math.random() < 0.4`, dùng một hàm kiểu `hash("x_y_z") % 10 < 4`. Như vậy vẫn có “40% phân bố” nhưng không cần `randomSeed`, vẫn deterministic, vẫn test được, vẫn reload ra y chang. Nếu muốn có randomness thật sau này, lúc đó mới thêm `randomSeed` vào `meta`. Hiện tại thì đừng vừa bỏ seed vừa giữ random, đó là combo “tự quăng bug vào mặt QA”. fileciteturn1file1 fileciteturn1file3

### Foundation rules đang có xung đột precedence

Trong `RULES_REFERENCE.md`, `Foundation Rules` mô tả `F-1: foundation_solid` khi `y === 0` và `neighbors.bottom === null`, còn `F-2: foundation_arch` khi `y === 0` và cell là rìa cụm. Vấn đề là với tầng `y === 0`, điều kiện `bottom === null` gần như luôn đúng; do đó một cell ở rìa cụm sẽ **match cả F-1 lẫn F-2**. Chính ví dụ trong file lại nói cell đơn lẻ tại `(0,0,0)` phải ra `foundation_arch`, nghĩa là thứ tự logic thực tế đang ngầm đòi **F-2 phải được xét trước F-1**, hoặc F-1 phải được viết lại thành “interior foundation only”. Nếu không sửa rõ, mỗi agent/dev sẽ hiểu một kiểu, test sẽ loạn như sạp rau hôm mưa. fileciteturn1file3

Khuyến nghị: đổi rule theo một trong hai cách. Cách sạch hơn là:
- `F-2` xét trước: nếu `y === 0` và có ít nhất một hướng ngang trống → `foundation_arch`.
- `F-1` sau đó mới áp dụng cho phần còn lại → `foundation_solid`.

Hoặc viết lại `F-1` thành “khi **không phải edge cell**” để loại chồng điều kiện ngay từ gốc. fileciteturn1file3

### Vite dev/prod chưa khóa contract build thật sự

AI nói đã confirm flow `app.isPackaged ? loadFile() : loadURL()`. Về Electron API thì đúng: `app.isPackaged` là cờ chuẩn để phân biệt dev/prod; `BrowserWindow.loadURL()` và `loadFile()` đều là API chính thức. Nhưng `implementation_plan.md` vẫn đang viết chéo chân nhau: một đoạn khẳng định renderer “không phải localhost”, đoạn khác lại nói “file:// hoặc localhost:5173 khi dev”. Thêm nữa, Vite hiện mặc định `base: '/'`; với packaged app dùng `loadFile()` thì assets cần **relative base** (`'./'` hoặc `''`) cho embedded deployment, nếu không build prod rất dễ dính đường dẫn asset tuyệt đối kiểu `/assets/...` không resolve đúng khi mở bằng file local. fileciteturn1file5 citeturn1view1turn7view3turn7view4turn10view0turn10view2

Khuyến nghị khóa spec luôn như sau:
- **Dev**: `win.loadURL('http://localhost:5173')`
- **Prod**: `win.loadFile(path.join(distDir, 'index.html'))` **hoặc** tốt hơn là custom `app://`
- **Vite**: thêm `base: './'` nếu vẫn dùng `loadFile()` ở production

Và rất quan trọng: `TASKS.md` hiện còn để `npm run dev` dùng “Vite hoặc electron-reload”. Nếu implementation plan đã chốt Vite, thì task cũng phải chốt Vite. Để hai lựa chọn song song là đang mời agent tự ý chọn đường khác. fileciteturn1file4 fileciteturn1file5 citeturn10view0turn10view2

### Cầu nối đang chưa chốt là cell logic hay derived overlay

`DATA_MODELS.md` có `BridgeSpec` riêng, nghe rất hợp lý cho một derived result. Nhưng trong `TASKS.md`, rule Bridge lại mô tả việc “sinh `bridge_span` vào cell khoảng cách nếu chưa có cell tại đó”. Hai cách này dẫn đến hai kiến trúc rất khác:
- **Bridge là cell thật**: nó tham gia topology, neighbor lookup, save/load, undo/redo như các block thường.
- **Bridge là derived visual overlay**: chỉ render từ chênh khoảng giữa hai cụm, không chiếm ô logic.

Đối với MVP, **derived overlay** là lựa chọn sạch hơn nhiều. Nó giữ `cells[]` chỉ gồm block do người chơi đặt, save file đơn giản hơn, topology ổn định hơn, và bridge có thể regenerate sau mỗi resolve mà không phá roof/wall logic. Nếu để bridge là cell thật từ đầu, mày sẽ phải xử lý một đống side effect ở neighbor counting, undo/redo và save migration. Chỗ này cần AI chốt **một** hướng trước khi code. fileciteturn1file1 fileciteturn1file3 fileciteturn1file4

### Security checklist của Electron chưa được phản ánh đủ trong Phase 0

Tài liệu hiện tại đã đi đúng hướng ở `nodeIntegration: false`, `contextIsolation: true`, preload bridge và sandbox. `CONVENTIONS.md` cũng push IPC qua `contextBridge`, thay vì thảy raw Node/Electron vào renderer, là tốt. Nhưng `TASKS.md` Phase 0 vẫn chưa thấy phản ánh đủ một số điểm bảo mật mà Electron security guide xem là baseline: **CSP**, **validate sender cho IPC**, **chặn navigation/new windows**, **không expose raw Electron APIs**, **prefer custom protocol hơn `file://`**, và **dùng version Electron còn được hỗ trợ/cập nhật**. fileciteturn1file0 fileciteturn1file4 citeturn12view1turn3view0turn5search1turn5search2

Cụ thể hơn:
- `contextIsolation` mặc định là `true`, `nodeIntegration` mặc định là `false`, `sandbox` mặc định là `true` từ Electron 20, và bật `nodeIntegration: true` sẽ tự tắt sandbox cho renderer đó. citeturn7view0turn7view1turn7view2
- Preload script là nơi phù hợp để expose privileged API qua `contextBridge`; không nên expose raw `ipcRenderer`/callback event object ra renderer. citeturn1view2turn4search0turn3view0
- Electron khuyến nghị `ipcRenderer.invoke()` ↔ `ipcMain.handle()` cho request/response, và IPC payload phải là structured-clone-safe, không phải DOM object hay special Electron object. citeturn5search1turn5search2

Phase 0 không nhất thiết phải làm custom `app://` ngay, nhưng ít nhất phải ghi nó vào backlog hardening, đồng thời thêm CSP và sender validation ngay từ skeleton. Nếu không, cái gọi là “secure IPC” mới chỉ là nửa cái khiên. citeturn3view0turn12view1

## Quyết định readiness cho Phase 0

Đánh giá của tao là **Ready có điều kiện**, không phải **Ready vô điều kiện**. Nói kiểu quản trị dự án cho rõ:

| Hạng mục | Trạng thái |
|---|---|
| Được phép scaffold package.json và cây thư mục | **Có, sau khi sync tài liệu** |
| Được phép scaffold `main.js`, `preload.js`, `index.html`, `app.js` | **Có, sau khi khóa dev/prod contract của Vite** |
| Được phép implement rule engine | **Chưa**, trước hết phải xử lý deterministic + precedence + bridge representation |
| Được phép nói “5 bước hoàn thành” | **Chưa nên**, vì implementation docs chưa đồng bộ với claim đó |

Nếu AI sửa xong các điểm sau, thì tao đồng ý cho nó bắt đầu Phase 0 ngay:
- cập nhật `implementation_plan.md` cho đúng trạng thái hiện tại;
- chốt **Vite-only** cho dev flow và thêm `base: './'` cho build nếu prod dùng `loadFile()`;
- sửa rule `wall_window` thành deterministic;
- sửa precedence của foundation rules;
- chốt bridge là **derived overlay** hay **real cell**, tốt nhất là overlay cho MVP;
- thêm security subtasks vào `TASKS.md` gồm CSP, sender validation, navigation/window-open restrictions;
- nếu tiếp tục đi JavaScript thuần, hãy ghi rõ đây là **quyết định supersede** khuyến nghị TypeScript trong deep report, để agent đời sau khỏi lộn kèo giữa `TypeScript khuyến nghị` và `TypeScript cấm trong source chính`. fileciteturn1file0 fileciteturn1file2 fileciteturn1file4 fileciteturn1file5 citeturn10view0turn10view2turn12view1turn3view0

Một chi tiết nhỏ nhưng nên làm ngay trong `package.json`: Electron docs khuyên `name` thường là slug lowercase, còn `productName` là tên hiển thị đầy đủ; vậy nếu AI sắp scaffold `package.json`, nên đặt kiểu `name: "coastlet-builder"` và `productName: "Coastlet Builder"` từ đầu cho đỡ phải backfill sau. citeturn1view1

## Nội dung nên trả lại cho AI

Mày có thể trả thẳng cho AI theo tinh thần dưới đây:

Bản đánh giá của tao là **chưa confirm vô điều kiện**. Hướng đi của mày đúng, nhưng trước khi scaffold Phase 0 phải sửa tài liệu cho đồng bộ. `implementation_plan.md` đang còn ghi `deep-research-report.md` là “chưa đọc” và 3 file mới là “chưa tạo”, trong khi mày vừa báo đã hoàn thành; chỗ này phải sync lại trước. `DATA_MODELS.md` nói MVP deterministic và không có `randomSeed`, nhưng `RULES_REFERENCE.md` lại dùng `Math.random() < 0.4` cho `wall_window`; phải đổi sang deterministic hash theo `cell.id` hoặc reintroduce seed một cách có chủ đích. `Foundation Rules` cũng đang conflict vì `F-1` và `F-2` cùng match ở `y === 0`; cần viết lại precedence rõ ràng. `Bridge` phải chốt là derived overlay hay cell thật; cho MVP nên dùng overlay để giữ topology sạch. Cuối cùng, `implementation_plan.md` và `TASKS.md` phải khóa hẳn flow Vite: dev dùng `loadURL('http://localhost:5173')`, prod dùng `loadFile(...)` hoặc `app://`, và nếu prod dùng `loadFile()` thì thêm `base: './'` trong Vite config. Đồng thời bổ sung security tasks cho Phase 0: CSP, validate sender, chặn navigation/new windows, không expose raw Electron IPC. Sửa xong các điểm đó thì mới nên tạo `package.json`, scaffold structure và setup Electron skeleton. fileciteturn1file1 fileciteturn1file3 fileciteturn1file4 fileciteturn1file5 citeturn1view1turn7view3turn10view2turn12view1turn3view0turn5search1

Kết luận chốt một câu: **không phải dừng lại, nhưng cũng chưa phải lúc bấm “triển luôn” kiểu mù quáng**. Chốt lại spec trước, rồi code sẽ mượt hơn nhiều. Nếu không, dự án sẽ vào mode kinh điển: file này nói A, file kia nói B, còn code thì nghe nhạc và chạy theo C. fileciteturn1file4 fileciteturn1file5