# Một bó hoa, một lời thương

Thiệp tương tác Ngày Phụ nữ Việt Nam 20/10, gửi từ Hiếu. Khu vườn ánh sáng và bó hoa sữa 3D khẽ chuyển động ngay khi trang mở. Một lần chạm vào bó hoa khởi động toàn bộ câu chuyện: ruy-băng bung, mười một cành hoa sữa rời bó theo nhịp riêng, giấy gói mở quanh phong thư và lá thư mở ra từng đoạn. Sau đó có thể chạm từng bông hoa để đọc thêm lời chúc và chia sẻ thiệp.

## Chạy local

Yêu cầu Node.js 22 và npm:

```sh
npm ci
npm run dev
```

Mở địa chỉ Vite in ra, mặc định `http://127.0.0.1:5173/`. Để tạo và xem bản production:

```sh
npm run build
npm run preview
```

`dist/` là đầu ra tĩnh. Cần phục vụ bằng HTTP; không mở `index.html` trực tiếp qua `file://`.

## Cấu trúc

| File                           | Vai trò                                                                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `index.html`                   | Nội dung thư, metadata 20/10, các điều khiển và lớp bó hoa dự phòng                                                  |
| `src/scene.ts`                 | Bó hoa sữa Three.js với 11 cành riêng, 33 cụm hoa, InstancedMesh, giấy gói, ruy-băng, phong thư và chuỗi chuyển động |
| `src/main.ts`                  | Điều phối một chạm, hiển thị từng đoạn, chọn bông hoa, nhạc và chia sẻ                                               |
| `src/style.css`                | Bố cục responsive, sân khấu, thư và bản vẽ CSS dự phòng                                                              |
| `src/content.ts`               | Lời chúc từng bông và nội dung chia sẻ                                                                               |
| `src/audio.ts`, `src/share.ts` | Nhạc nền MP3; Web Share, Clipboard và phương án sao chép thủ công                                                    |
| `tests/card.spec.ts`           | Kiểm tra hành trình, viewport, thao tác và tình huống dự phòng                                                       |

Nội dung thư và chữ ký là HTML thật trong `index.html`. Để sửa lời chúc ngắn của từng bông, chỉnh `src/content.ts`.

## Chuyển động và khả năng truy cập

- Mô hình hoa sữa được dựng procedural trong Three.js, không dùng ảnh hoặc asset 3D bên ngoài: 11 cành cong riêng, mỗi cành có 3 cụm đầu cành; mỗi cụm có 18 hoa con năm thùy nhỏ trên desktop và 14 trên điện thoại. Tổng cộng là 33 cụm, 594 hoa con trên desktop hoặc 462 trên điện thoại. Mỗi cành có 6 lá hình bầu dục xanh đậm trên desktop hoặc 5 trên điện thoại, có gân giữa và độ cong nhẹ.
- Cành là các nhóm 3D độc lập, rời bó cách nhau 340 ms, lượn gần camera rồi rơi theo quỹ đạo cong và xoay nhẹ; chúng đọng lại quanh lá thư với các đường sáng mảnh. Bó hoa giữ đủ 11 cành trong trạng thái đầu. Giấy gói mở trên bản lề sau khi cành bắt đầu tách, rồi phong thư trượt ra và lá thư gấp mở.
- Hoa con và lá dùng InstancedMesh; mỗi cành gộp các ống thân thành một mesh tĩnh riêng. Điện thoại dùng ít hoa con/lá hơn và ít đoạn hình học hơn, cùng giới hạn pixel ratio 1.2; desktop tối đa 1.5. Cảnh chạy tối đa 30 khung hình/giây và tạm ngừng khi tab bị ẩn hoặc sân khấu nằm ngoài màn hình.
- Sau khi thư mở, hoa ở lại quanh thư. Các vùng chạm trên sân khấu và hàng nút bên dưới đều gọi đúng lời chúc; hàng nút cũng dùng được bằng bàn phím.
- Màn mở đầu có chuyển động nền chậm; khử răng cưa tắt trên màn nhỏ.
- Với `prefers-reduced-motion`, một lần chạm chạy chuỗi rút gọn và giảm chuyển động nền; giấy gói vẫn bung, phong thư trượt ra hết, lá thư mở trọn và lời chúc hiện lần lượt với chuyển động nhỏ. Sau đó, 18 cụm hoa rơi một lượt trên desktop hoặc 12 cụm trên điện thoại rồi dừng. Nếu chế độ thay đổi giữa chuỗi, cảnh hoàn tất ngay.
- Nếu WebGL không có, mất context hoặc chunk 3D không tải được, bố cục CSS và thư HTML vẫn hoạt động. Khi tắt JavaScript, thư vẫn đọc được.
- Trang thử phát bản nhạc tổng hợp nhỏ nhẹ khi mở. Nếu trình duyệt chặn autoplay, nút luôn hiện “Bật nhạc”; khi phát nhạc, nút đổi thành “Tắt nhạc”. Nhạc tạm dừng khi rời tab và thử tiếp tục khi quay lại nếu trước đó đang bật.
- Font Lora tiếng Việt được lưu trong bản build; không gọi dịch vụ font, ảnh, nhạc hoặc analytics bên ngoài.

## Kiểm tra

```sh
npm run format:check
npm run typecheck
npm run build
npm test
```

`npm test` dùng bản `dist/` vừa build, tự mở và tắt preview server. Trên Windows, Playwright dùng Chrome đã cài. Trên hệ điều hành khác, cài Chromium bằng `npx playwright install chromium` trước lần chạy đầu.

Các bài kiểm tra bao gồm chuỗi 3D tự chạy sau một lần chạm; số lượng 11 cành/33 cụm và mật độ hoa theo desktop/mobile; màn hình dọc và ngang 320–1440 px; nhấp chuột, cảm ứng, bàn phím; reduced motion; WebGL mất context/không có; mất chunk 3D; Web Share và clipboard; nhạc; mất mạng sau khi tải; và đọc thư khi tắt JavaScript. Ảnh chụp trạng thái đầu và giữa lúc cành tách nằm trong thư mục kết quả Playwright dưới `test-results/`.

Chưa kiểm tra trên thiết bị iPhone/Android thật hoặc Safari/Firefox. Web Share và Clipboard thường cần HTTPS khi đưa lên mạng. Phần Three.js tải riêng sau mã giao diện đầu tiên, khoảng 140 KB gzip. Giấy phép font Lora đi kèm tại `public/lora-license.txt`.

## Deploy lên Cloudflare Pages

Trang tạo bản build bằng `npm run build` với thư mục đầu ra `dist`. Nếu Pages đang kết nối GitHub, mỗi lần push lên nhánh production được chọn trong Cloudflare sẽ tự build và cập nhật website. Repo này dùng nhánh `main`; kiểm tra nhánh production tại Workers & Pages → project → Settings → Builds & deployments.

Trước khi push, có thể kiểm tra bản build local bằng `npm run build`. Sau đó stage các file đã sửa, commit và push lên nhánh production. Các biến bí mật phải được lưu trong Cloudflare Pages → Settings → Variables and Secrets; không commit chúng vào Git.
