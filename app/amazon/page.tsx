/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";

type SeoResult={productName:string;seoTitle:string;bullets:string[];description:string;backendKeywords:string[];htmlDescription:string;csvRows:Record<string,string>[];productMeta?:{asin?:string;url?:string;image?:string}};
type ImportItem={id:string;productUrl?:string;imageUrl?:string;jinaImageUrl?:string;affiliateUrl?:string;reviewUrl?:string;asin?:string;title?:string;brand?:string;rating?:string;reviewCount?:string;warning?:string;status:"ready"|"needs_product_url";rawLines:string[]};
type BulkRow={index:number;productUrl:string;imageUrl?:string;affiliateUrl?:string;reviewUrl?:string;asin:string;title:string;bullets:string[];backendKeywords:string;status:"ready"|"needs_product_url";brand?:string;rating?:string;reviewCount?:string;warning?:string};
type GeneratedPack={blog:string;html:string;sns:string};
type Tab="bulk"|"single"|"content"|"jina";

const markets=[{v:"US",l:"🇺🇸 미국"},{v:"KR",l:"🇰🇷 한국"},{v:"JP",l:"🇯🇵 일본"},{v:"UK",l:"🇬🇧 영국"},{v:"CA",l:"🇨🇦 캐나다"},{v:"DE",l:"🇩🇪 독일"}];
const languages=[{v:"ko",l:"한국어"},{v:"en",l:"영어"},{v:"ko-en",l:"한국어+영어"},{v:"ja",l:"일본어"},{v:"es",l:"스페인어"}];
const sample=`https://www.amazon.com/First-Aid-Beauty-Exfoliating-Compostable/dp/B0G8TPX5DR/ref=prem26_sum_pp_grid?th=1
https://amzn.to/4vOptiJ

https://www.amazon.com/AUTOMET-Outfits-Lounge-Oversized-Tracksuit/dp/B0B8NCDQG3/
https://amzn.to/4aEFVcS`;

export default function AmazonPage(){
  const[url,setUrl]=useState("");const[productName,setProductName]=useState("");const[productInfo,setProductInfo]=useState("");const[marketplace,setMarketplace]=useState("US");const[language,setLanguage]=useState("ko");const[result,setResult]=useState<SeoResult|null>(null);const[loading,setLoading]=useState(false);const[bulkInput,setBulkInput]=useState("");const[htmlInput,setHtmlInput]=useState("");const[importItems,setImportItems]=useState<ImportItem[]>([]);const[bulkRows,setBulkRows]=useState<BulkRow[]>([]);const[activeTab,setActiveTab]=useState<Tab>("bulk");const[generated,setGenerated]=useState<GeneratedPack|null>(null);const[selectedItem,setSelectedItem]=useState<ImportItem|null>(null);const[jinaPrompt,setJinaPrompt]=useState("");
  const readyCount=useMemo(()=>importItems.filter(i=>i.status==="ready").length,[importItems]);
  const withImage=useMemo(()=>importItems.filter(i=>i.imageUrl).length,[importItems]);
  async function generate(){setLoading(true);try{const r=await fetch("/api/amazon/seo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,productName,productInfo,marketplace,language})});const j=await r.json();if(!j.success)return alert(j.message||"생성 실패");setResult(j.data);localStorage.setItem("amazonSeoProject",JSON.stringify(j.data));setActiveTab("single");}finally{setLoading(false)}}
  async function parseBulk(){setLoading(true);try{const r=await fetch("/api/amazon/import",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:bulkInput,html:htmlInput})});const j=await r.json();setImportItems(j.data||[]);setBulkRows([]);localStorage.setItem("amazonImportItems",JSON.stringify(j.data||[]));}finally{setLoading(false)}}
  async function runBulk(){setLoading(true);try{const r=await fetch("/api/amazon/bulk",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({input:bulkInput,html:htmlInput,keyword:productName})});const j=await r.json();setBulkRows(j.data||[]);if(!importItems.length)setImportItems((j.data||[]).map((row:BulkRow)=>({id:String(row.index),productUrl:row.productUrl,imageUrl:row.imageUrl,affiliateUrl:row.affiliateUrl,reviewUrl:row.reviewUrl,asin:row.asin,status:row.status,rawLines:[],title:row.title,brand:row.brand,rating:row.rating,reviewCount:row.reviewCount,warning:row.warning})));}finally{setLoading(false)}}
  function updateItem(id:string,patch:Partial<ImportItem>){setImportItems(prev=>{const next=prev.map(item=>item.id===id?{...item,...patch}:item);localStorage.setItem("amazonImportItems",JSON.stringify(next));return next;});}
  function saveImportItems(){localStorage.setItem("amazonImportItems",JSON.stringify(importItems));alert(`${importItems.length}개 상품 정보를 저장했습니다.`);}
  function copySingleSeo(){const text=[url&&`제품링크: ${url}`,productName&&`상품명: ${productName}`,productInfo].filter(Boolean).join("\n\n");navigator.clipboard.writeText(text).then(()=>alert("복사되었습니다."))}
  function saveSingleSeo(){const data={url,productName,productInfo,savedAt:new Date().toISOString()};localStorage.setItem("amazonSingleSeoInfo",JSON.stringify(data));alert("단일 SEO 정보를 저장했습니다. /writing 에서 \"단일 SEO 정보 가져오기\"로 불러올 수 있어요.")}
  function applyItem(item:ImportItem){setSelectedItem(item);setUrl(item.productUrl||"");setProductName(item.title||item.asin||"");setProductInfo([item.productUrl&&`제품링크: ${item.productUrl}`,item.brand&&`브랜드: ${item.brand}`,item.rating&&`평점: ${item.rating}`,item.reviewCount&&`리뷰수: ${item.reviewCount}`,item.imageUrl&&`이미지링크: ${item.imageUrl}`,item.affiliateUrl&&`제휴링크: ${item.affiliateUrl}`,item.reviewUrl&&`리뷰링크: ${item.reviewUrl}`].filter(Boolean).join("\n"));setActiveTab("single")}
  function makeContent(item:ImportItem){
    const title=item.title||productName||`Amazon 상품 ${item.asin||""}`;
    const link=item.affiliateUrl||item.productUrl||"";
    const productLink=item.productUrl||link;
    const image=item.jinaImageUrl||item.imageUrl||"";
    const review=item.reviewUrl||"";
    const brand=item.brand||"Amazon";
    const rating=item.rating||"상세 페이지에서 확인 필요";
    const reviewCount=item.reviewCount||"상세 페이지에서 확인 필요";
    const keyword=title.split(/\s+/).slice(0,8).join(" ");
    const blog=`${title} 실사용 리뷰형 구매 가이드

이 글은 Amazon 상품 URL, 제휴 URL, 이미지 URL, 리뷰 URL을 기준으로 블로그에 바로 옮겨 쓸 수 있게 만든 긴 리뷰 초안입니다. 상품명은 ${title}이며, 브랜드는 ${brand}, ASIN은 ${item.asin||"확인 필요"}입니다. 평점은 ${rating}, 리뷰 수는 ${reviewCount}로 기록되어 있으나 실제 구매 전에는 Amazon 상세 페이지에서 최신 옵션과 가격을 다시 확인하는 것이 좋습니다.

[핵심 요약]
이 제품은 검색으로 들어온 방문자에게 상품 특징, 구매 전 체크 포인트, 실제 사용 상황, 장단점, FAQ를 한 번에 보여주기 좋은 리뷰형 콘텐츠에 적합합니다. 특히 제휴 링크를 CTA 버튼으로 분리해두면 본문 이미지, 중간 버튼, 마지막 구매 버튼에 같은 링크를 반복 배치할 수 있어 클릭 흐름이 자연스러워집니다.

[이 제품을 볼 만한 사람]
1. Amazon에서 ${keyword} 관련 상품을 비교 중인 사람
2. 구매 전 실제 리뷰와 별점 흐름을 먼저 확인하고 싶은 사람
3. 상품 옵션, 사이즈, 구성, 배송 정보를 한 번에 정리하고 싶은 사람
4. 블로그 리뷰나 SNS 소개용으로 상품 정보를 빠르게 정리하려는 사람

[구매 전 체크 포인트]
첫째, 상품명과 옵션이 정확히 일치하는지 확인해야 합니다. Amazon 상품은 색상, 사이즈, 수량, 리뉴얼 버전에 따라 가격과 리뷰가 달라질 수 있습니다. 둘째, 최근 리뷰를 먼저 보세요. 오래된 리뷰보다 최근 1~3개월 리뷰가 실제 품질과 배송 상태를 더 잘 보여주는 경우가 많습니다. 셋째, 별점 낮은 리뷰도 꼭 확인하세요. 장점보다 단점이 내 사용 목적에 치명적인지 판단하는 것이 중요합니다.

[장점]
- 상품 URL과 제휴 URL을 따로 관리할 수 있어 블로그 CTA 구성이 쉽습니다.
- 이미지가 있으면 썸네일, 본문 대표 이미지, 카드뉴스로 확장하기 좋습니다.
- 리뷰 URL을 별도 제공하면 독자가 구매 전에 실제 후기를 바로 확인할 수 있습니다.
- ${brand} 브랜드 정보와 ASIN 기준으로 콘텐츠 관리가 편합니다.

[아쉬운 점]
- Amazon 페이지 구조가 바뀌거나 차단되면 이미지/평점 자동 추출이 실패할 수 있습니다.
- 가격은 자주 변동되므로 글 작성 시점의 가격을 고정적으로 단정하지 않는 것이 안전합니다.
- 의류, 뷰티, 생활용품은 개인차가 커서 사이즈표와 최근 사진 리뷰 확인이 필요합니다.

[블로그 작성 팁]
본문 상단에는 상품 이미지를 넣고, 이미지 아래에 제휴 링크 버튼을 배치하세요. 중간에는 장단점 표를 넣고, 하단에는 FAQ와 리뷰 확인 버튼을 넣으면 체류시간과 클릭률을 같이 높일 수 있습니다.

상품 확인: ${link}
리뷰 확인: ${review||"리뷰 URL 없음"}`;
    const html=`<article class="wp-modern-post amazon-review-post">
<style>
.wp-modern-post{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.75;color:#1f2937;max-width:920px;margin:0 auto;padding:24px}.wp-modern-post h1{font-size:34px;line-height:1.25;margin:0 0 18px;font-weight:900;color:#111827}.wp-modern-post h2{font-size:24px;margin:38px 0 14px;padding-left:14px;border-left:5px solid #f59e0b;font-weight:900;color:#111827}.wp-modern-post h3{font-size:19px;margin:24px 0 10px;font-weight:800}.summary-box,.tip-box,.warning-box{border-radius:18px;padding:20px;margin:22px 0}.summary-box{background:#fff7ed;border:1px solid #fed7aa}.tip-box{background:#eff6ff;border:1px solid #bfdbfe}.warning-box{background:#fff1f2;border:1px solid #fecdd3}.toc{background:#f8fafc;border:1px solid #e5e7eb;border-radius:18px;padding:18px;margin:22px 0}.toc a{display:block;color:#2563eb;text-decoration:none;margin:6px 0;font-weight:700}.product-img{max-width:55%;display:block;margin:24px auto;border-radius:20px;box-shadow:0 18px 45px rgba(15,23,42,.16)}.cta-btn{display:inline-block;padding:18px 42px;border-radius:999px;background:linear-gradient(135deg,#f97316,#f59e0b);color:#fff!important;text-decoration:none;font-weight:900;margin:14px auto}.btn-wrap{text-align:center}.review-table{width:100%;border-collapse:collapse;margin:18px 0;border-radius:16px;overflow:hidden}.review-table th,.review-table td{border:1px solid #e5e7eb;padding:13px;text-align:left}.review-table th{background:#f9fafb}.faq{border:1px solid #e5e7eb;border-radius:16px;padding:16px;margin:12px 0;background:#fff}@media(max-width:640px){.product-img{max-width:100%}.wp-modern-post{padding:16px}.wp-modern-post h1{font-size:28px}}
</style>
<meta name="title" content="${escapeHtml(title)} Review and Buying Guide">
<meta name="description" content="${escapeHtml(title)} 구매 전 확인할 핵심 특징, 장단점, 리뷰 체크 포인트, FAQ를 정리한 Amazon 리뷰 가이드입니다.">
<h1>${escapeHtml(title)} 구매 전 체크 리뷰</h1>
<div class="summary-box"><strong>핵심 요약:</strong> 이 글은 ${escapeHtml(title)} 상품을 구매하기 전 확인해야 할 특징, 장점, 단점, 리뷰 체크 포인트, FAQ를 정리한 Amazon 제휴 리뷰 콘텐츠입니다.</div>
<nav class="toc"><strong>목차</strong><a href="#intro">1. 제품 소개</a><a href="#points">2. 핵심 구매 포인트</a><a href="#review">3. 리뷰 확인 방법</a><a href="#proscons">4. 장단점 정리</a><a href="#checklist">5. 구매 전 체크리스트</a><a href="#faq">6. FAQ</a></nav>
${image?`<a href="${escapeHtml(link)}" target="_blank" rel="nofollow sponsored noopener"><img class="product-img" src="${escapeHtml(image)}" alt="${escapeHtml(title)}"></a><div class="btn-wrap"><a class="cta-btn" href="${escapeHtml(link)}" target="_blank" rel="nofollow sponsored noopener">Amazon에서 상품 확인하기</a></div>`:""}
<h2 id="intro">제품 소개</h2><p><strong>${escapeHtml(title)}</strong>은 Amazon에서 확인할 수 있는 상품입니다. 현재 저장된 브랜드는 <strong>${escapeHtml(brand)}</strong>, ASIN은 <strong>${escapeHtml(item.asin||"확인 필요")}</strong>입니다. 평점 정보는 <strong>${escapeHtml(rating)}</strong>, 리뷰 수는 <strong>${escapeHtml(reviewCount)}</strong>로 기록되어 있습니다.</p>
<p>구매 전에는 색상, 사이즈, 구성품, 배송 옵션, 반품 조건을 반드시 확인하는 것이 좋습니다. Amazon 상품은 같은 페이지 안에서도 옵션별 가격과 리뷰가 달라질 수 있기 때문입니다.</p>
<h2 id="points">핵심 구매 포인트</h2><table class="review-table"><tr><th>항목</th><th>체크 내용</th></tr><tr><td>상품 링크</td><td><a href="${escapeHtml(productLink)}" target="_blank" rel="nofollow noopener">원본 상품 페이지 확인</a></td></tr><tr><td>제휴 링크</td><td><a href="${escapeHtml(link)}" target="_blank" rel="nofollow sponsored noopener">구매 CTA에 사용할 링크</a></td></tr><tr><td>리뷰 링크</td><td>${review?`<a href="${escapeHtml(review)}" target="_blank" rel="nofollow noopener">실제 리뷰 확인</a>`:"리뷰 링크 없음"}</td></tr><tr><td>이미지</td><td>${image?"대표 이미지 확보 완료":"이미지 직접 붙여넣기 필요"}</td></tr></table>
<h2 id="review">리뷰 확인 방법</h2><p>좋은 리뷰만 보는 것보다 최근 리뷰, 사진 리뷰, 별점 낮은 리뷰를 함께 보는 것이 중요합니다. 특히 의류, 뷰티, 전자기기, 생활용품은 사용 환경에 따라 만족도가 달라질 수 있습니다.</p><div class="tip-box"><strong>실전 팁:</strong> 리뷰 페이지에서 최근순으로 정렬한 뒤 같은 불만이 반복되는지 확인하세요. 같은 문제가 반복되면 구매 전 한 번 더 고민하는 것이 좋습니다.</div>
<h2 id="proscons">장단점 정리</h2><table class="review-table"><tr><th>장점</th><th>아쉬운 점</th></tr><tr><td>Amazon 상세 페이지에서 옵션과 리뷰를 바로 확인 가능</td><td>가격과 재고는 수시로 변동될 수 있음</td></tr><tr><td>제휴 링크를 블로그 버튼과 이미지 링크에 활용 가능</td><td>자동 추출 실패 시 이미지 URL 수동 입력 필요</td></tr><tr><td>카드뉴스와 SNS 문구로 재활용하기 쉬움</td><td>실사용 만족도는 개인차가 있음</td></tr></table>
<h2 id="checklist">구매 전 체크리스트</h2><ul><li>상품명과 옵션이 내가 원하는 제품과 일치하는지 확인</li><li>최근 리뷰와 사진 리뷰 확인</li><li>별점 낮은 리뷰에서 반복되는 단점 확인</li><li>배송일, 반품 가능 여부, 판매자 정보 확인</li><li>가격 변동 가능성을 고려해 최종 결제 전 가격 재확인</li></ul>
<div class="warning-box"><strong>주의:</strong> 이 글은 구매 판단을 돕는 정보성 리뷰 초안입니다. 가격, 재고, 평점, 리뷰 수는 Amazon 페이지에서 실시간으로 다시 확인하세요.</div>
<div class="btn-wrap"><a class="cta-btn" href="${escapeHtml(link)}" target="_blank" rel="nofollow sponsored noopener">최신 가격과 옵션 확인하기</a></div>
<h2 id="faq">FAQ</h2><div class="faq"><h3>Q1. 이 제품은 어디에서 확인하나요?</h3><p>위 버튼 또는 상품 링크를 통해 Amazon 상세 페이지에서 확인할 수 있습니다.</p></div><div class="faq"><h3>Q2. 리뷰는 꼭 확인해야 하나요?</h3><p>네. 최근 리뷰와 별점 낮은 리뷰를 함께 확인하면 구매 실패 가능성을 줄일 수 있습니다.</p></div><div class="faq"><h3>Q3. 이미지가 자동으로 안 나오면 어떻게 하나요?</h3><p>Amazon 상품 이미지 주소 또는 HTML img 태그를 가져오기 매니저의 HTML 보조 추출 칸에 붙여넣으면 됩니다.</p></div><div class="faq"><h3>Q4. 제휴 링크는 어디에 넣는 것이 좋나요?</h3><p>상품 이미지, 이미지 아래 버튼, 본문 중간 CTA, 마지막 CTA에 자연스럽게 배치하는 것이 좋습니다.</p></div><div class="faq"><h3>Q5. 가격 정보는 글에 확정적으로 써도 되나요?</h3><p>가격은 자주 변동되므로 “작성 시점 기준” 또는 “최신 가격은 Amazon에서 확인”처럼 표현하는 것이 안전합니다.</p></div>
<p><strong>해시태그:</strong> #AmazonReview #AmazonFinds #아마존추천 #상품리뷰 #구매가이드 #제휴마케팅 #리뷰글 #쇼핑정보 #구매전체크 #블로그수익화</p>
</article>`;
    const sns=`요즘 Amazon에서 체크해볼 만한 상품 👀\n\n${title}\n브랜드: ${brand}\n⭐ ${rating}\n리뷰: ${reviewCount}\n\n구매 전에는 옵션/사이즈/최근 리뷰/별점 낮은 리뷰를 꼭 확인하세요.\n\n상품 확인: ${link}\n${review?`리뷰 확인: ${review}\n`:""}\n#AmazonFinds #아마존추천 #구매전체크 #상품리뷰`;
    setGenerated({blog,html,sns});setSelectedItem(item);setActiveTab("content");
  }

  function openInAI(item:ImportItem){
    const title=item.title||productName||`Amazon 상품 ${item.asin||""}`;
    const input=`제품주소: ${item.productUrl||""}\n제품제휴주소: ${item.affiliateUrl||""}\n이미지주소: ${item.imageUrl||""}\n리뷰주소: ${item.reviewUrl||""}\n\n역할: 너는 SEO 전문 콘텐츠 에디터 + 아마존 제휴 마케팅 전문가 + 데이터 기반 리뷰 분석가이다.\n\n아래 상품으로 WordPress/Blogger에 바로 붙여넣을 수 있는 긴 HTML 리뷰글을 작성해줘.\n\n작성 규칙:\n1. HTML 코드 중심으로 작성\n2. 최소 3,500~5,000자 이상\n3. SEO META 태그 포함\n4. 목차, 서론, 핵심요약, 주요 특징, 장단점, 구매 전 체크리스트, 리뷰 분석, FAQ 5개, 결론 포함\n5. 이미지 클릭 시 제휴 링크로 이동\n6. 이미지 아래와 본문 중간/마지막에 제휴 링크 버튼 삽입\n7. 가격은 실시간 변동 가능하므로 단정하지 말고 Amazon에서 확인하도록 안내\n8. 상품명: ${title}\n브랜드: ${item.brand||""}\nASIN: ${item.asin||""}\n평점: ${item.rating||""}\n리뷰수: ${item.reviewCount||""}`;
    localStorage.setItem("ai-pro-draft",JSON.stringify({mode:"blog",tone:"seo",language,systemPrompt:"너는 SEO 전문 콘텐츠 에디터 + 아마존 제휴 마케팅 전문가 + 데이터 기반 리뷰 분석가다. product_url, affiliate_url, image_urls, review_url을 활용해 긴 HTML 리뷰글, 가격/리뷰 분석, CTA 버튼, Schema, 검색설명 후보를 생성한다.",input,variables:`상품명=${title}\n제휴링크=${item.affiliateUrl||""}\n이미지=${item.imageUrl||""}\n리뷰주소=${item.reviewUrl||""}`}));
    window.location.href="/ai";
  }

  function inferDetailCategory(title:string):string{
    if(/cream|serum|lotion|skincare|makeup|cosmetic|lipstick|sunscreen|moisturiz/i.test(title))return "화장품";
    if(/vitamin|supplement|protein|snack|tea|coffee|food/i.test(title))return "식품/건강기능식품";
    if(/dress|shirt|top|outfit|jacket|pants|jeans|shoe|sneaker|bag|backpack/i.test(title))return "패션/의류";
    if(/headphone|earbud|charger|laptop|monitor|camera|speaker|smart|electronic/i.test(title))return "가전/전자/IT";
    if(/yoga|fitness|gym|running|bike|sports|workout/i.test(title))return "스포츠/운동";
    if(/kitchen|home|furniture|storage|organizer|bedding/i.test(title))return "생활/리빙";
    return "일반 상품";
  }
  function sendToWritingDetail(item:ImportItem){
    const title=item.title||productName||`Amazon 상품 ${item.asin||""}`;
    const draft={
      brand:item.brand||"",
      productName:title,
      detailCategory:inferDetailCategory(title),
      platform:"Amazon",
      specs:[item.rating&&`평점 ${item.rating}`,item.reviewCount&&`리뷰 ${item.reviewCount}개`].filter(Boolean).join(", "),
      request:[`제품 링크: ${item.productUrl||""}`,`제휴 링크: ${item.affiliateUrl||""}`,item.reviewUrl&&`리뷰 링크: ${item.reviewUrl}`,item.jinaImageUrl&&`진아 착용/사용 이미지: ${item.jinaImageUrl}`].filter(Boolean).join("\n"),
      productUrl:item.productUrl||"",
      imageUrl:item.jinaImageUrl||item.imageUrl||"",
    };
    localStorage.setItem("writingDraft",JSON.stringify(draft));
    window.location.href="/writing";
  }
  function deleteAmazonResult(){setResult(null);setGenerated(null);setSelectedItem(null);localStorage.removeItem("amazonSeoProject");}
  function copy(t:string){navigator.clipboard.writeText(t).then(()=>alert("복사되었습니다."))}
  const OUTFIT_POOLS:Record<string,string[]>={
    "화장품":["a soft white bathrobe","a cozy cream knit sweater","a simple white tank top with damp hair, fresh-faced skincare vibe","a silk pajama set"],
    "식품/건강기능식품":["a relaxed beige cardigan","a casual denim jacket over a white tee","a cozy oversized hoodie"],
    "가전/전자/IT":["a chic oversized blazer","a minimalist black turtleneck","a casual streetwear hoodie"],
    "패션/의류":["a coordinated casual outfit that complements the product"],
    "스포츠/운동":["a fitted sports bra and leggings","an athletic zip-up jacket over a tank top","a breathable workout set"],
    "생활/리빙":["a cozy loungewear set","a linen home dress","a soft oversized cardigan"],
    "일반 상품":["a casual chic outfit","a simple elegant blouse","a trendy streetwear look"],
  };
  function pickOutfitFor(category:string){const pool=OUTFIT_POOLS[category]||OUTFIT_POOLS["일반 상품"];return pool[Math.floor(Math.random()*pool.length)]}
  function buildJinaProductPrompt(item?:ImportItem){
    const title=(item?.title||productName||url||"Amazon product").trim();
    const image=item?.imageUrl||selectedItem?.imageUrl||"";
    const isWearable=/dress|top|shirt|outfit|bikini|swim|watch|bag|backpack|headphone|earbud|case|bottle/i.test(title);
    const category=isWearable?"wearing or naturally using":"naturally posing with";
    const outfitClause=isWearable?"":` Jina is wearing ${pickOutfitFor(inferDetailCategory(title))},`;
    return `AI influencer Jina, realistic Korean female lifestyle influencer, warm clean beauty look,${outfitClause} premium Amazon product review photo, Jina is ${category} the product: ${title}. Natural studio lighting, realistic skin texture, elegant commercial photography, product clearly visible, clean background, social media ready, high resolution, no text, no logo, no watermark.${image?` Reference product image URL: ${image}`:""}`;
  }
  function generateJinaProductPrompt(item?:ImportItem){
    const prompt=buildJinaProductPrompt(item);
    setJinaPrompt(prompt);
    setActiveTab("jina");
  }
  function sendJinaPromptToInfluencer(item?:ImportItem){
    const prompt=jinaPrompt||buildJinaProductPrompt(item);
    localStorage.setItem("jina_external_prompt_inbox",prompt);
    window.location.href="/influencer";
  }
  function csv(){const rows=bulkRows.length?bulkRows.map(r=>({asin:r.asin,productUrl:r.productUrl,imageUrl:r.imageUrl||"",affiliateUrl:r.affiliateUrl||"",reviewUrl:r.reviewUrl||"",title:r.title,bullets:r.bullets.join(" | "),backendKeywords:r.backendKeywords})):(importItems.length?importItems.map(i=>({asin:i.asin||"",productUrl:i.productUrl||"",imageUrl:i.imageUrl||"",affiliateUrl:i.affiliateUrl||"",reviewUrl:i.reviewUrl||"",title:i.title||"",brand:i.brand||"",rating:i.rating||"",reviewCount:i.reviewCount||""})):[{title:result?.seoTitle||"",description:result?.description||"",backendKeywords:result?.backendKeywords?.join(" ")||""}]);const headers=Array.from(new Set(rows.flatMap(r=>Object.keys(r))));const body=[headers.join(","),...rows.map(r=>headers.map(h=>`"${String((r as Record<string,string>)[h]||"").replace(/"/g,'""')}"`).join(","))].join("\n");const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(body);a.download="amazon-import-export.csv";a.click()}
  return <main className="min-h-screen bg-slate-50 p-8 text-slate-950"><div className="mb-6 flex justify-between gap-4"><div><p className="text-sm font-semibold text-orange-600">v3.5 Amazon Import Manager</p><h1 className="text-4xl font-black">아마존 가져오기 매니저</h1><p className="text-slate-500">제품주소 + 제휴주소 자동 페어링, 이미지 보조 추출, 리뷰 URL, 블로그/SNS/HTML 리뷰글 생성을 한 화면에서 처리합니다.</p></div><div className="flex gap-2"><button onClick={deleteAmazonResult} className="cursor-pointer rounded-xl bg-red-50 px-5 py-3 font-bold text-red-600 transition hover:bg-red-100 active:scale-95">현재 생성 삭제</button><button onClick={csv} className="cursor-pointer rounded-xl bg-green-600 px-5 py-3 font-bold text-white transition hover:scale-[1.02] active:scale-95">CSV 다운로드</button><button onClick={generate} disabled={loading} className="cursor-pointer rounded-xl bg-slate-950 px-5 py-3 font-bold text-white transition hover:scale-[1.02] disabled:opacity-50 active:scale-95">{loading?"처리 중":"SEO 생성"}</button></div></div>
  <div className="mb-5 flex gap-2">{[["bulk","대량 가져오기"],["single","단일 SEO"],["content","리뷰글/SNS"],["jina","진아 상품이미지"]].map(([id,label])=><button key={id} onClick={()=>setActiveTab(id as Tab)} className={`cursor-pointer rounded-xl px-4 py-3 font-bold transition active:scale-95 ${activeTab===id?"bg-blue-600 text-white":"border bg-white hover:bg-slate-100"}`}>{label}</button>)}</div>
  <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
    <section className="space-y-4 rounded-3xl border bg-white p-6 shadow-sm">
      {activeTab==="bulk"?<><div className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-900"><b>2줄 입력 + HTML 보조 추출</b><br/>제품주소와 amzn.to 제휴주소를 순서대로 붙이면 자동 페어링합니다. 이미지가 안 나오면 Amazon 이미지 태그나 상품 영역 HTML을 아래에 붙여넣으세요.</div><textarea className="h-52 w-full rounded-xl border p-3" placeholder={sample} value={bulkInput} onChange={e=>setBulkInput(e.target.value)}/><textarea className="h-32 w-full rounded-xl border border-dashed p-3" placeholder="이미지 추출 실패 시 여기에 Amazon <img ...> 또는 상품 영역 HTML 붙여넣기" value={htmlInput} onChange={e=>setHtmlInput(e.target.value)}/><div className="grid grid-cols-2 gap-3"><button onClick={parseBulk} disabled={loading} className="cursor-pointer rounded-xl border bg-white py-3 font-bold transition hover:bg-slate-100 active:scale-95">URL 자동 분류</button><button onClick={runBulk} disabled={loading} className="cursor-pointer rounded-xl bg-orange-600 py-3 font-bold text-white transition hover:scale-[1.02] active:scale-95">대량 SEO 분석</button></div>{importItems.length>0&&<button onClick={saveImportItems} className="w-full cursor-pointer rounded-xl bg-emerald-600 py-3 font-bold text-white transition hover:scale-[1.02] active:scale-95">💾 정보 저장 ({importItems.length}개)</button>}<button onClick={()=>setBulkInput(sample)} className="w-full cursor-pointer rounded-xl bg-slate-100 py-3 font-bold transition hover:bg-slate-200 active:scale-95">예시 입력 채우기</button></>:<><input className="w-full rounded-xl border p-3" placeholder="Amazon 상품 URL" value={url} onChange={e=>setUrl(e.target.value)}/><input className="w-full rounded-xl border p-3" placeholder="상품명 / ASIN / 핵심 키워드" value={productName} onChange={e=>setProductName(e.target.value)}/><textarea className="h-44 w-full rounded-xl border p-3" placeholder="상품 특징, 리뷰 요약, 경쟁상품, 사이즈, 재질, 타깃 고객, 주의사항" value={productInfo} onChange={e=>setProductInfo(e.target.value)}/><div className="grid grid-cols-2 gap-3"><button onClick={copySingleSeo} className="cursor-pointer rounded-xl border bg-white py-3 font-bold transition hover:bg-slate-100 active:scale-95">📋 복사</button><button onClick={saveSingleSeo} className="cursor-pointer rounded-xl bg-emerald-600 py-3 font-bold text-white transition hover:scale-[1.02] active:scale-95">💾 저장</button></div></>}
      <div className="grid grid-cols-2 gap-3"><select className="rounded-xl border p-3" value={marketplace} onChange={e=>setMarketplace(e.target.value)}>{markets.map(v=><option key={v.v} value={v.v}>{v.l}</option>)}</select><select className="rounded-xl border p-3" value={language} onChange={e=>setLanguage(e.target.value)}>{languages.map(v=><option key={v.v} value={v.v}>{v.l}</option>)}</select></div>
      <div className="grid grid-cols-3 gap-3 text-center text-sm"><Stat label="전체" value={importItems.length}/><Stat label="준비됨" value={readyCount}/><Stat label="이미지" value={withImage}/></div>
    </section>
    <main className="space-y-5">{activeTab==="bulk"?<BulkImport items={importItems} rows={bulkRows} ready={readyCount} applyItem={applyItem} updateItem={updateItem} deleteItem={(id)=>{const next=importItems.filter((item)=>item.id!==id);setImportItems(next);localStorage.setItem("amazonImportItems",JSON.stringify(next));}} makeContent={makeContent} openInAI={openInAI} generateJina={generateJinaProductPrompt} sendToWriting={sendToWritingDetail}/>:activeTab==="content"?<ContentPanel item={selectedItem} generated={generated} copy={copy}/>:activeTab==="jina"?<JinaAmazonPanel item={selectedItem} prompt={jinaPrompt} productName={productName} setProductName={setProductName} makePrompt={()=>generateJinaProductPrompt(selectedItem||undefined)} sendToInfluencer={()=>sendJinaPromptToInfluencer(selectedItem||undefined)} copy={copy}/>:result?<Result result={result} copy={copy}/>:<section className="rounded-3xl border bg-white p-10 text-center text-gray-500 shadow-sm">상품 정보를 입력하고 SEO 생성을 누르세요.</section>}</main>
  </div></main>}

function BulkImport({items,rows,ready,applyItem,updateItem,deleteItem,makeContent,openInAI,generateJina,sendToWriting}:{items:ImportItem[];rows:BulkRow[];ready:number;applyItem:(i:ImportItem)=>void;updateItem:(id:string,patch:Partial<ImportItem>)=>void;deleteItem:(id:string)=>void;makeContent:(i:ImportItem)=>void;openInAI:(i:ImportItem)=>void;generateJina:(i:ImportItem)=>void;sendToWriting:(i:ImportItem)=>void}){return <section className="rounded-3xl border bg-white p-6 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black">자동 분류 결과</h2><div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">총 {items.length}개 · 준비 {ready}개</div></div>{items.length===0?<div className="rounded-2xl bg-slate-50 p-10 text-center text-slate-400">URL을 붙여넣고 “URL 자동 분류”를 누르세요.</div>:<div className="grid gap-4 2xl:grid-cols-2">{items.map((item,index)=><div key={item.id} className="rounded-2xl border p-4 transition hover:border-blue-400 hover:shadow-sm"><div className="flex gap-4"><div className="h-28 w-28 overflow-hidden rounded-xl bg-slate-100">{item.imageUrl?<img src={item.imageUrl} alt="상품 이미지" className="h-full w-full object-cover"/>:<div className="flex h-full items-center justify-center p-2 text-center text-xs text-slate-400">이미지 URL을 아래에 붙여넣기</div>}</div><div className="min-w-0 flex-1"><div className="text-xs font-bold text-orange-600">상품 {index+1} · {item.asin||"ASIN 확인 필요"}</div><input className="mt-1 w-full rounded-lg border px-2 py-1 text-sm font-bold" value={item.title||""} placeholder="상품명 직접 입력 가능" onChange={e=>updateItem(item.id,{title:e.target.value})}/><div className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-500"><span>{item.imageUrl?"✅ 이미지":"⚠️ 이미지 없음"}</span><span>{item.affiliateUrl?"✅ 제휴링크":"— 제휴링크"}</span><span>{item.reviewUrl?"✅ 리뷰주소":"⏳ 리뷰주소"}</span><span>{item.rating?`⭐ ${item.rating}`:(item.status==="ready"?"✅ 분석 가능":"⚠️ 확인 필요")}</span></div></div></div><div className="mt-3 space-y-2 text-xs text-slate-500"><Line label="제품" value={item.productUrl}/><input className="w-full rounded-lg border px-2 py-2" placeholder="이미지 URL 직접 붙여넣기" value={item.imageUrl||""} onChange={e=>updateItem(item.id,{imageUrl:e.target.value})}/><Line label="제휴" value={item.affiliateUrl}/><Line label="리뷰" value={item.reviewUrl}/><Line label="경고" value={item.warning}/></div><div className="mt-3 grid grid-cols-3 gap-2"><button onClick={()=>applyItem(item)} className="cursor-pointer rounded-xl bg-slate-950 py-2 text-xs font-bold text-white">SEO로 보내기</button><button onClick={()=>makeContent(item)} className="cursor-pointer rounded-xl bg-blue-600 py-2 text-xs font-bold text-white">글 생성</button><button onClick={()=>openInAI(item)} className="cursor-pointer rounded-xl bg-purple-600 py-2 text-xs font-bold text-white">AI Pro</button><button onClick={()=>generateJina(item)} className="cursor-pointer rounded-xl bg-pink-600 py-2 text-xs font-bold text-white">진아컷{item.jinaImageUrl?" ✓":""}</button><button onClick={()=>sendToWriting(item)} className="cursor-pointer rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white">웹상세 빌더로</button><button onClick={()=>navigator.clipboard.writeText(item.affiliateUrl||item.productUrl||"").then(()=>alert("복사되었습니다."))} className="cursor-pointer rounded-xl border py-2 text-xs font-bold">링크 복사</button></div><button onClick={()=>deleteItem(item.id)} className="mt-2 w-full rounded-xl bg-red-50 py-2 text-xs font-bold text-red-600">이 상품 삭제</button></div>)}</div>}{rows.length>0&&<div className="mt-6 rounded-2xl bg-green-50 p-4 text-sm font-bold text-green-800">대량 SEO 분석 완료: {rows.length}개 결과가 CSV 다운로드에 포함됩니다.</div>}</section>}

function JinaAmazonPanel({item,prompt,productName,setProductName,makePrompt,sendToInfluencer,copy}:{item:ImportItem|null;prompt:string;productName:string;setProductName:(v:string)=>void;makePrompt:()=>void;sendToInfluencer:()=>void;copy:(t:string)=>void}){return <section className="space-y-5 rounded-3xl border bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><div className="text-sm font-black text-pink-600">AI Influencer Jina x Amazon SEO</div><h2 className="text-2xl font-black">진아가 제품을 착용/사용한 이미지 생성</h2><p className="mt-2 text-sm text-slate-500">여기서는 프롬프트만 만들고, 실제 이미지는 진아 얼굴 고정 레퍼런스가 있는 인플루언서 생성기에서 만듭니다 (그래야 매번 같은 얼굴로 나와요).</p></div><a href="/influencer" className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white">전용 생성기 열기</a></div><div className="grid gap-4 lg:grid-cols-[220px_1fr]"><div className="overflow-hidden rounded-2xl bg-slate-100">{item?.imageUrl?<img src={item.imageUrl} alt="상품 이미지" className="h-full min-h-56 w-full object-cover"/>:<div className="flex min-h-56 items-center justify-center p-4 text-center text-sm text-slate-400">대량 가져오기에서 상품을 선택하거나 상품명을 입력하세요.</div>}</div><div className="space-y-3"><input className="w-full rounded-xl border p-3" value={productName||item?.title||""} onChange={e=>setProductName(e.target.value)} placeholder="진아 이미지에 반영할 상품명"/><div className="grid grid-cols-2 gap-2"><button onClick={makePrompt} className="rounded-xl border py-3 font-black">프롬프트 다시 만들기</button><button onClick={()=>copy(prompt)} disabled={!prompt} className="rounded-xl border py-3 font-black disabled:opacity-40">프롬프트 복사</button></div><textarea readOnly value={prompt||"프롬프트 다시 만들기를 누르면 상품명과 상품 이미지를 반영한 프롬프트가 만들어집니다."} className="h-40 w-full rounded-xl border bg-slate-50 p-3 text-sm"/><button onClick={sendToInfluencer} disabled={!prompt} className="w-full rounded-xl bg-pink-600 py-4 font-black text-white disabled:opacity-40">🔒 진아 얼굴로 생성하러 가기</button><p className="text-xs text-slate-400">누르면 이 프롬프트를 담아서 /influencer 로 이동하고, &quot;외부 프롬프트로 생성&quot; 칸에 자동으로 채워져 있어요. 거기서 진아 얼굴 참조 이미지와 함께 생성하면 훨씬 결과가 좋습니다.</p></div></div></section>}
function ContentPanel({item,generated,copy}:{item:ImportItem|null;generated:GeneratedPack|null;copy:(t:string)=>void}){if(!generated)return <section className="rounded-3xl border bg-white p-10 text-center text-slate-500">대량 가져오기 결과에서 “글 생성”을 누르면 블로그 글, HTML 리뷰글, SNS 문구가 생성됩니다.</section>;return <section className="space-y-4 rounded-3xl border bg-white p-6 shadow-sm"><div><div className="text-sm font-bold text-blue-600">{item?.asin||"선택 상품"}</div><h2 className="text-2xl font-black">리뷰 콘텐츠 자동 생성</h2></div>{[["블로그 글",generated.blog],["HTML 리뷰글",generated.html],["SNS 문구",generated.sns]].map(([label,text])=><div key={label} className="rounded-2xl border p-4"><div className="mb-2 flex items-center justify-between"><h3 className="font-black">{label}</h3><button onClick={()=>copy(text)} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white">복사</button></div><textarea readOnly value={text} className="h-48 w-full rounded-xl border bg-slate-50 p-3 text-sm"/></div>)}</section>}
function Result({result,copy}:{result:SeoResult;copy:(t:string)=>void}){return <section className="space-y-4 rounded-3xl border bg-white p-6 shadow-sm"><h2 className="text-2xl font-black">{result.seoTitle}</h2><div className="rounded-2xl bg-slate-50 p-4"><b>Bullet Points</b><ul className="mt-2 list-disc pl-5">{result.bullets.map((b,i)=><li key={i}>{b}</li>)}</ul></div><div className="rounded-2xl bg-slate-50 p-4"><b>Description</b><p className="mt-2 whitespace-pre-wrap">{result.description}</p></div><button onClick={()=>copy(result.htmlDescription)} className="cursor-pointer rounded-xl bg-slate-950 px-5 py-3 font-bold text-white">HTML 복사</button></section>}
function Line({label,value}:{label:string;value?:string}){return <div className="grid grid-cols-[54px_1fr] gap-2"><b className="text-slate-700">{label}</b><span className="truncate" title={value}>{value||"-"}</span></div>}
function Stat({label,value}:{label:string;value:number}){return <div className="rounded-2xl bg-slate-100 p-3"><div className="text-2xl font-black">{value}</div><div className="text-xs text-slate-500">{label}</div></div>}
function escapeHtml(value:string){return value.replace(/[<>&"']/g,(c)=>({"<":"&lt;",">":"&gt;","&":"&amp;","\"":"&quot;","'":"&#39;"}[c]||c))}
