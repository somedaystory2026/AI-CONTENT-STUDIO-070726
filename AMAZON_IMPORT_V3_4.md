# v3.4 Amazon 2-Line Import 업데이트

## 목표
사용자가 매번 제품 이미지 URL, 리뷰 URL까지 입력하지 않아도 되도록 Amazon Import Manager를 개선했습니다.

## 입력 방식
이제 아래처럼 제품주소와 제휴주소만 붙여넣어도 됩니다.

```txt
https://www.amazon.com/First-Aid-Beauty-Exfoliating-Compostable/dp/B0G8TPX5DR/ref=...
https://amzn.to/4vOptiJ
```

여러 상품도 같은 방식으로 반복 입력할 수 있습니다.

```txt
https://www.amazon.com/dp/B0G8TPX5DR
https://amzn.to/4vOptiJ

https://www.amazon.com/dp/B0B8NCDQG3
https://amzn.to/4aEFVcS
```

## 자동 처리
- 제품 URL에서 ASIN 자동 추출
- 기본 제품 URL 자동 정리
- 리뷰 URL 자동 생성
- amzn.to 제휴주소 그대로 저장
- Amazon 페이지 HTML 접근이 가능하면 상품명, 브랜드, 평점, 리뷰수, 메인 이미지, Bullet까지 자동 추출
- Amazon 페이지 접근이 막혀도 ASIN/제품주소/리뷰주소/제휴주소는 유지

## 추가 파일
- `lib/amazon-product-extractor.ts`

## 수정 파일
- `lib/amazon-import-parser.ts`
- `app/api/amazon/import/route.ts`
- `app/api/amazon/bulk/route.ts`
- `app/amazon/page.tsx`
- `package.json`
