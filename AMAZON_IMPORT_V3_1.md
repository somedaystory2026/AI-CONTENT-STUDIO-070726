# v3.1 Amazon SEO Import Manager

## 추가된 기능

- 제품주소, 제품이미지주소, 아마존 제휴주소, 리뷰주소를 한 번에 붙여넣는 Bulk Import UI
- URL 순서가 섞여 있어도 자동 분류
- `m.media-amazon.com` 이미지 URL 자동 인식
- `amzn.to` 제휴 링크 자동 인식
- `/dp/ASIN`, `/gp/product/ASIN`, `asin=` ASIN 자동 추출
- 리뷰 URL 자동 분류
- 상품별 이미지 미리보기
- 단일 상품으로 보내기
- 대량 SEO 결과 CSV 다운로드
- Amazon SEO 페이지 한국어 UI 강화

## 새 API

- `POST /api/amazon/import`
- `POST /api/amazon/bulk` 개선

## 사용 예시

아래처럼 순서 상관없이 붙여넣으면 됩니다.

```txt
https://m.media-amazon.com/images/I/611LEDM3cKL._AC_SY741_.jpg
https://www.amazon.com/AUTOMET-Outfits-Lounge-Oversized-Tracksuit/dp/B0B8NCDQG3/
https://amzn.to/4vGzApC
https://www.amazon.com/AUTOMET-Outfits-Lounge-Oversized-Tracksuit/dp/B0B8NCDQG3/#customerReviews
```
