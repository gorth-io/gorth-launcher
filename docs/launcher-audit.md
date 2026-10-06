# Đối chiếu launcher — 2026-10-04

Đối chiếu mã Gorth với các checkout PrismLauncher, FreesmLauncher và elyprism-pinecone trong `packages`. Đây là đánh giá mức triển khai, không phải chứng nhận mọi tính năng đã được kiểm thử live trên mọi hệ điều hành.

## Đã có

- Electron/React, sidebar, settings, account UI, webview dự án Modrinth/CurseForge.
- SQLite/Drizzle và migration; tạo/đổi tên/copy/Trash/restore instance; icon và nhóm.
- Vanilla release từ 1.7.10; curated Fabric/Forge/NeoForge; Temurin theo metadata.
- Cấu hình RAM/JVM/Java/account/resolution/environment/lifecycle riêng từng instance.
- Modrinth/CurseForge: tìm kiếm/cài, inventory, bật/tắt/xóa/update, dependency guards; resource/shader/data pack; tự cài Iris cho các loader được hỗ trợ.
- Import mrpack/CurseForge ZIP; export instance ZIP; parser import Prism/MultiMC và một số dạng metadata FTB.
- World list/backup/restore, screenshots, servers.dat, notes và log/crash report.
- Hàng đợi tải Minecraft theo instance; nhiều process game; pause/resume/cancel/stop riêng; MB/s và ETA; console tìm kiếm/lọc/export; crash hints; lịch sử phiên trong SQLite.

## Còn thiếu hoặc cần hoàn thiện

- Online game auth thực tế: `lib/auth/service.ts` vẫn đặt Ely/Gorth game provider thành false và từ chối identity online. Gorth launcher SSO cần cấu hình client và kiểm thử live. Pinecone có OAuth Ely và official Authlib patches cho skin server (`packages/elyprism-pinecone/README.md`).
- Signing/notarization, updater/channels/rollback và CI đa nền tảng. Version sản phẩm vẫn 0.0.0. Prism có subsystem updater và workflow phát hành.
- FTB API/catalog đầy đủ, Packwiz, ATLauncher, Technic. Prism có implementation từng nền tảng tại `packages/PrismLauncher/launcher/modplatform`; Gorth FTB hiện là parser import dữ liệu local, chưa tương đương FTB platform.
- Import/export chưa bảo toàn đầy đủ mọi cấu hình Prism/FTB; ZIP instance không phải export mrpack/CurseForge manifest. Cần fixture và kiểm thử round-trip thực tế cho từng định dạng.
- Dependency guards hiện dựa metadata provider; chưa đọc và giải toàn bộ constraint bên trong mọi JAR external như một mod resolver đầy đủ.
- Runtime switch giữ mod/config/world; chưa tự chuyển mod sang bản tương thích hoặc ngăn downgrade world.
- Orphan recovery hiện chỉ nhận Gorth installed.json; chưa nhận diện mọi thư mục không có receipt.
- Shortcut các nền tảng đã có mã nhưng chưa kiểm thử end-to-end cả Windows/Linux; shortcut khi chạy bản dev cần thêm hỗ trợ entrypoint.
- Queue chưa bền qua restart; resume giữ file hoàn tất nhưng không tiếp tục byte của file dở bằng HTTP Range. Tốc độ là bytes/second trung bình; ETA theo file chỉ là xấp xỉ.
- Console chỉ giữ 1.000 dòng gần nhất mỗi instance; export giới hạn buffer này, chưa ghi toàn bộ session log riêng. Crash hints là heuristic, không phải kết luận chắc chắn. Lịch sử chỉ giữ 1.000 phiên, tổng hiện cộng các phiên còn lưu.
- Kiểm thử trực tiếp nhiều Minecraft process đồng thời, shutdown/process tree và tổng RAM trên Windows/macOS/Linux cần bổ sung.
- Skin manager, đa ngôn ngữ, proxy, Discord Rich Presence, profiler, news, deep links, clipboard screenshot, launcher backup và kiểm tra dung lượng đĩa.

Microsoft, Quilt, snapshot và các mod-loader version ngoài catalog là giới hạn sản phẩm chủ đích, không tính là thiếu.

## Ưu tiên tiếp theo

1. Online auth và phát hành có signing/update/CI.
2. Kiểm thử scheduler và nhiều process thật trên profile riêng; lưu queue/session logs bền và thống kê playtime không bị giới hạn retention.
3. Import/export FTB/Prism round-trip, các nền tảng còn lại, dependency metadata từ JAR và bảo vệ world khi đổi runtime.
4. Các tiện ích UX/P2.
