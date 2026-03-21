/**
 * StudioPartnersOusen.tsx — Landing page "Studio Partners"
 * Rota: /studio-partners-ousen
 * Design: Editorial serif · Autoridade B2B · Tipografia Playfair + DM Sans
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useMotionValue,
  useSpring,
  animate,
} from "framer-motion";

// ─── Tokens ───────────────────────────────────────────────────────────────────

const GREEN      = "#D2F525";
const GREEN_DIM  = "#b8d91f";

const BG         = "#0D0D0D";
const BG2        = "#141414";
const BG3        = "#1c1c1c";

const TEXT_1     = "#F2EDE4";   // warm off-white
const TEXT_2     = "#999080";   // warm muted
const TEXT_3     = "#4a4540";   // warm dim

const BORDER     = "rgba(242,237,228,0.07)";
const BORDER2    = "rgba(242,237,228,0.13)";

const E1 = [0.22, 1, 0.36, 1] as const;

// ─── Google Fonts ─────────────────────────────────────────────────────────────

const FONT_LINK = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700;1,900&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
`;

// ─── Logo SVG ─────────────────────────────────────────────────────────────────

function LogoSVG({ size = 28 }: { size?: number }) {
  const scale = size / 28;
  return (
    <svg width={Math.round(217 * scale)} height={size} viewBox="0 0 217 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="27.7511" height="28" rx="3.58938" fill="#D2F525" />
      <path d="M14.771 14.5566C14.3617 14.9578 13.5534 15.2858 12.9746 15.2858H7.12158C6.54279 15.2858 6.40405 14.9578 6.81333 14.5566L13.2191 8.27801C13.6284 7.87686 14.4367 7.54858 15.0155 7.54858H20.8685C21.4473 7.54858 21.586 7.87686 21.1768 8.27801L14.771 14.5566Z" fill="#282828" />
      <path d="M14.7612 20.0894C14.352 20.4905 13.5436 20.8188 12.9648 20.8188H7.11182C6.53302 20.8188 6.39429 20.4905 6.80356 20.0894L13.2091 13.8108C13.6184 13.4096 14.4268 13.0815 15.0055 13.0815H20.8585C21.4373 13.0815 21.5761 13.4096 21.1668 13.8108L14.7612 20.0894Z" fill="#282828" />
      <path d="M43.6855 20.2563C42.6175 20.2563 41.6492 20.0783 40.7806 19.7223C39.9262 19.3521 39.2499 18.811 38.7515 18.099C38.2531 17.387 37.9825 16.5113 37.9398 15.4718H41.3573C41.3715 15.8848 41.4783 16.2479 41.6777 16.5611C41.8771 16.8744 42.1476 17.1236 42.4894 17.3087C42.8311 17.4796 43.2298 17.565 43.6855 17.565C44.0699 17.565 44.4046 17.5081 44.6894 17.3942C44.9884 17.266 45.2234 17.088 45.3942 16.8602C45.5651 16.6181 45.6505 16.3191 45.6505 15.9631C45.6505 15.5929 45.5509 15.2796 45.3515 15.0233C45.1522 14.7527 44.8816 14.5249 44.5399 14.3398C44.1981 14.1404 43.7994 13.9624 43.3437 13.8058C42.9023 13.6349 42.4253 13.4712 41.9127 13.3145C40.7308 12.9301 39.8194 12.4103 39.1787 11.7553C38.5521 11.1003 38.2388 10.2245 38.2388 9.12809C38.2388 8.21676 38.4596 7.4407 38.901 6.79992C39.3566 6.1449 39.9761 5.64651 40.7592 5.30476C41.5424 4.96301 42.4324 4.79214 43.4292 4.79214C44.4544 4.79214 45.3586 4.97013 46.1418 5.32612C46.925 5.66787 47.5444 6.17338 48.0001 6.84264C48.4557 7.49766 48.6978 8.28083 48.7263 9.19217H45.2874C45.2732 8.8789 45.1806 8.5941 45.0098 8.33779C44.8531 8.08148 44.6324 7.87501 44.3476 7.71837C44.0771 7.56173 43.7567 7.48342 43.3864 7.48342C43.0589 7.46918 42.7599 7.51902 42.4894 7.63293C42.233 7.73261 42.0194 7.89636 41.8486 8.1242C41.6919 8.33779 41.6136 8.60834 41.6136 8.93585C41.6136 9.24912 41.6919 9.5268 41.8486 9.76887C42.0194 9.9967 42.2473 10.1961 42.5321 10.3669C42.8311 10.5236 43.1729 10.6731 43.5573 10.8155C43.956 10.9579 44.3903 11.1003 44.8602 11.2427C45.6149 11.499 46.3056 11.8051 46.9321 12.1611C47.5729 12.5029 48.0855 12.9585 48.47 13.5281C48.8687 14.0835 49.068 14.8239 49.068 15.7495C49.068 16.5611 48.8544 17.3087 48.4273 17.9922C48.0143 18.6757 47.4091 19.2239 46.6117 19.6369C45.8285 20.0498 44.8531 20.2563 43.6855 20.2563ZM54.9702 20.2563C54.0731 20.2563 53.3113 20.0712 52.6848 19.701C52.0725 19.3307 51.6026 18.7896 51.2751 18.0777C50.9618 17.3514 50.8052 16.4686 50.8052 15.4291V9.23488H54.0091V15.1087C54.0091 15.9061 54.1728 16.5184 54.5003 16.9456C54.8278 17.3586 55.3547 17.565 56.0809 17.565C56.5223 17.565 56.9139 17.4654 57.2557 17.266C57.6117 17.0666 57.8822 16.7747 58.0673 16.3903C58.2667 16.0058 58.3664 15.5359 58.3664 14.9806V9.23488H61.5703V20H58.7722L58.5159 18.2913C58.2026 18.8751 57.7469 19.3521 57.1489 19.7223C56.5508 20.0783 55.8246 20.2563 54.9702 20.2563ZM63.811 24.6991V9.23488H66.6518L67.0149 10.6446C67.2427 10.3456 67.5062 10.0679 67.8052 9.81159C68.1042 9.55527 68.4602 9.35592 68.8732 9.21353C69.3004 9.05689 69.7987 8.97857 70.3683 8.97857C71.3651 8.97857 72.2408 9.22776 72.9955 9.72615C73.7645 10.2245 74.3768 10.9009 74.8324 11.7553C75.2881 12.5954 75.5159 13.5566 75.5159 14.6388C75.5159 15.721 75.281 16.6893 74.8111 17.5437C74.3554 18.3838 73.7431 19.0459 72.9742 19.5301C72.2052 20.0142 71.3437 20.2563 70.3897 20.2563C69.6207 20.2563 68.9586 20.121 68.4033 19.8505C67.8479 19.5799 67.3851 19.2026 67.0149 18.7184V24.6991H63.811ZM69.578 17.4582C70.0906 17.4582 70.5463 17.3443 70.945 17.1165C71.358 16.8744 71.6784 16.5398 71.9062 16.1126C72.134 15.6854 72.2479 15.1941 72.2479 14.6388C72.2479 14.0835 72.134 13.5922 71.9062 13.165C71.6784 12.7378 71.358 12.4032 70.945 12.1611C70.5463 11.9048 70.0906 11.7766 69.578 11.7766C69.0512 11.7766 68.5813 11.9048 68.1683 12.1611C67.7696 12.4032 67.4563 12.7378 67.2285 13.165C67.0007 13.5922 66.8867 14.0763 66.8867 14.6174C66.8867 15.1728 67.0007 15.6641 67.2285 16.0912C67.4563 16.5184 67.7696 16.8531 68.1683 17.0951C68.5813 17.3372 69.0512 17.4582 69.578 17.4582ZM82.7372 20.2563C81.6265 20.2563 80.6511 20.0285 79.811 19.5728C78.9709 19.1029 78.3087 18.455 77.8246 17.6291C77.3547 16.789 77.1197 15.8278 77.1197 14.7456C77.1197 13.6349 77.3547 12.6453 77.8246 11.7766C78.2945 10.908 78.9495 10.2245 79.7896 9.72615C80.6298 9.22776 81.6052 8.97857 82.7159 8.97857C83.7981 8.97857 84.745 9.21352 85.5567 9.68343C86.3683 10.1533 87.002 10.7941 87.4576 11.6058C87.9275 12.4032 88.1625 13.3288 88.1625 14.3825C88.1625 14.5249 88.1554 14.6886 88.1411 14.8738C88.1411 15.0446 88.1269 15.2226 88.0984 15.4077H79.4052V13.5495H84.8945C84.866 12.9514 84.6453 12.4744 84.2324 12.1184C83.8337 11.7482 83.3353 11.5631 82.7372 11.5631C82.2816 11.5631 81.8686 11.6699 81.4984 11.8834C81.1281 12.097 80.8291 12.4174 80.6013 12.8446C80.3877 13.2718 80.2809 13.8129 80.2809 14.4679V15.1087C80.2809 15.6071 80.3735 16.0485 80.5586 16.433C80.7579 16.8175 81.0356 17.1165 81.3916 17.3301C81.7618 17.5437 82.1961 17.6505 82.6945 17.6505C83.1644 17.6505 83.5489 17.5579 83.8479 17.3728C84.1612 17.1734 84.4033 16.9243 84.5741 16.6252H87.8421C87.6428 17.3087 87.301 17.9281 86.8169 18.4835C86.3327 19.0246 85.7418 19.4589 85.044 19.7864C84.3463 20.0997 83.5774 20.2563 82.7372 20.2563ZM89.9846 20V9.23488H92.8253L93.1244 11.1999C93.4092 10.7443 93.7438 10.3527 94.1283 10.0252C94.5127 9.69767 94.9542 9.44136 95.4525 9.25624C95.9652 9.07113 96.5134 8.97857 97.0972 8.97857V12.3747H96.0293C95.6021 12.3747 95.2105 12.4245 94.8545 12.5242C94.5127 12.6097 94.2137 12.7592 93.9574 12.9728C93.7153 13.1864 93.5231 13.4783 93.3807 13.8485C93.2525 14.2045 93.1885 14.653 93.1885 15.1941V20H89.9846ZM98.4625 20V5.04845H108.48V7.63293H101.666V11.1572H107.839V13.6349H101.666V17.4155H108.48V20H98.4625ZM110.443 20V4.62126H113.647V20H110.443ZM121.192 20.2563C120.082 20.2563 119.106 20.0285 118.266 19.5728C117.426 19.1029 116.764 18.455 116.28 17.6291C115.81 16.789 115.575 15.8278 115.575 14.7456C115.575 13.6349 115.81 12.6453 116.28 11.7766C116.75 10.908 117.405 10.2245 118.245 9.72615C119.085 9.22776 120.06 8.97857 121.171 8.97857C122.253 8.97857 123.2 9.21352 124.012 9.68343C124.823 10.1533 125.457 10.7941 125.913 11.6058C126.383 12.4032 126.618 13.3288 126.618 14.3825C126.618 14.5249 126.611 14.6886 126.596 14.8738C126.596 15.0446 126.582 15.2226 126.554 15.4077H117.86V13.5495H123.35C123.321 12.9514 123.101 12.4744 122.688 12.1184C122.289 11.7482 121.79 11.5631 121.192 11.5631C120.737 11.5631 120.324 11.6699 119.954 11.8834C119.583 12.097 119.284 12.4174 119.056 12.8446C118.843 13.2718 118.736 13.8129 118.736 14.4679V15.1087C118.736 15.6071 118.829 16.0485 119.014 16.433C119.213 16.8175 119.491 17.1165 119.847 17.3301C120.217 17.5437 120.651 17.6505 121.15 17.6505C121.62 17.6505 122.004 17.5579 122.303 17.3728C122.616 17.1734 122.858 16.9243 123.029 16.6252H126.297C126.098 17.3087 125.756 17.9281 125.272 18.4835C124.788 19.0246 124.197 19.4589 123.499 19.7864C122.801 20.0997 122.033 20.2563 121.192 20.2563ZM128.44 20V9.23488H131.238L131.515 10.6232C131.857 10.1249 132.306 9.72615 132.861 9.42712C133.431 9.12809 134.086 8.97857 134.826 8.97857C135.353 8.97857 135.83 9.04977 136.257 9.19217C136.684 9.32032 137.062 9.51968 137.389 9.79023C137.717 10.0465 137.987 10.3741 138.201 10.7728C138.614 10.2174 139.141 9.78311 139.782 9.46984C140.422 9.14233 141.12 8.97857 141.875 8.97857C142.843 8.97857 143.64 9.17081 144.267 9.55527C144.908 9.93974 145.385 10.4951 145.698 11.2213C146.011 11.9475 146.168 12.8304 146.168 13.8699V20H142.985V14.1475C142.985 13.3644 142.829 12.7592 142.516 12.332C142.217 11.8906 141.732 11.6699 141.063 11.6699C140.636 11.6699 140.259 11.7766 139.931 11.9902C139.604 12.2038 139.347 12.5029 139.162 12.8873C138.991 13.2718 138.906 13.7346 138.906 14.2757V20H135.723V14.1475C135.723 13.3644 135.567 12.7592 135.253 12.332C134.94 11.8906 134.435 11.6699 133.737 11.6699C133.338 11.6699 132.975 11.7766 132.648 11.9902C132.334 12.2038 132.085 12.5029 131.9 12.8873C131.729 13.2718 131.644 13.7346 131.644 14.2757V20H128.44ZM153.603 20.2563C152.492 20.2563 151.517 20.0285 150.676 19.5728C149.836 19.1029 149.174 18.455 148.69 17.6291C148.22 16.789 147.985 15.8278 147.985 14.7456C147.985 13.6349 148.22 12.6453 148.69 11.7766C149.16 10.908 149.815 10.2245 150.655 9.72615C151.495 9.22776 152.471 8.97857 153.581 8.97857C154.664 8.97857 155.611 9.21352 156.422 9.68343C157.234 10.1533 157.867 10.7941 158.323 11.6058C158.793 12.4032 159.028 13.3288 159.028 14.3825C159.028 14.5249 159.021 14.6886 159.007 14.8738C159.007 15.0446 158.992 15.2226 158.964 15.4077H150.271V13.5495H155.76C155.732 12.9514 155.511 12.4744 155.098 12.1184C154.699 11.7482 154.201 11.5631 153.603 11.5631C153.147 11.5631 152.734 11.6699 152.364 11.8834C151.994 12.097 151.695 12.4174 151.467 12.8446C151.253 13.2718 151.146 13.8129 151.146 14.4679V15.1087C151.146 15.6071 151.239 16.0485 151.424 16.433C151.623 16.8175 151.901 17.1165 152.257 17.3301C152.627 17.5437 153.062 17.6505 153.56 17.6505C154.03 17.6505 154.414 17.5579 154.713 17.3728C155.027 17.1734 155.269 16.9243 155.44 16.6252H158.708C158.508 17.3087 158.167 17.9281 157.682 18.4835C157.198 19.0246 156.607 19.4589 155.91 19.7864C155.212 20.0997 154.443 20.2563 153.603 20.2563ZM160.85 20V9.23488H163.648L163.904 10.965C164.232 10.3669 164.695 9.8899 165.293 9.53392C165.891 9.16369 166.617 8.97857 167.471 8.97857C168.369 8.97857 169.123 9.17081 169.736 9.55527C170.348 9.93974 170.811 10.4951 171.124 11.2213C171.451 11.9333 171.615 12.809 171.615 13.8485V20H168.433V14.1475C168.433 13.3644 168.262 12.7592 167.92 12.332C167.592 11.8906 167.066 11.6699 166.339 11.6699C165.912 11.6699 165.521 11.7766 165.165 11.9902C164.823 12.1896 164.552 12.4815 164.353 12.866C164.154 13.2504 164.054 13.7132 164.054 14.2543V20H160.85ZM178.79 20C178.007 20 177.316 19.879 176.718 19.6369C176.12 19.3806 175.657 18.9676 175.33 18.398C175.002 17.8285 174.838 17.0524 174.838 16.0699V11.9048H173.002V9.23488H174.838L175.18 6.20186H178.042V9.23488H180.798V11.9048H178.042V16.1126C178.042 16.5398 178.135 16.8459 178.32 17.031C178.519 17.2019 178.854 17.2874 179.324 17.2874H180.798V20H178.79ZM187.212 20.2563C186.201 20.2563 185.325 20.0997 184.585 19.7864C183.859 19.4589 183.282 19.0175 182.855 18.4621C182.442 17.9068 182.207 17.2802 182.15 16.5825H185.333C185.39 16.8246 185.489 17.0453 185.632 17.2446C185.788 17.4298 185.995 17.5793 186.251 17.6932C186.522 17.7929 186.821 17.8427 187.148 17.8427C187.504 17.8427 187.789 17.8 188.002 17.7145C188.23 17.6149 188.401 17.4867 188.515 17.3301C188.629 17.1734 188.686 17.0097 188.686 16.8388C188.686 16.5683 188.601 16.3618 188.43 16.2194C188.273 16.077 188.038 15.9631 187.725 15.8776C187.412 15.778 187.034 15.6854 186.593 15.6C186.08 15.4861 185.568 15.3579 185.055 15.2155C184.556 15.0589 184.108 14.8666 183.709 14.6388C183.325 14.411 183.011 14.1191 182.769 13.7631C182.542 13.3928 182.428 12.9443 182.428 12.4174C182.428 11.7766 182.606 11.1999 182.962 10.6873C183.318 10.1605 183.83 9.74751 184.5 9.44848C185.169 9.13521 185.98 8.97857 186.935 8.97857C188.287 8.97857 189.348 9.2776 190.117 9.87566C190.886 10.4737 191.342 11.2783 191.484 12.2893H188.494C188.408 12.0045 188.23 11.7909 187.96 11.6485C187.689 11.4919 187.347 11.4135 186.935 11.4135C186.465 11.4135 186.109 11.4919 185.867 11.6485C185.624 11.8051 185.503 12.0116 185.503 12.2679C185.503 12.4388 185.582 12.5954 185.738 12.7378C185.909 12.866 186.151 12.9799 186.465 13.0796C186.778 13.1792 187.162 13.2789 187.618 13.3786C188.487 13.5637 189.234 13.7631 189.861 13.9767C190.502 14.1903 191 14.5035 191.356 14.9165C191.712 15.3152 191.883 15.899 191.869 16.6679C191.883 17.3657 191.698 17.9851 191.313 18.5262C190.943 19.0673 190.409 19.4945 189.711 19.8078C189.013 20.1068 188.18 20.2563 187.212 20.2563ZM195.223 20.1068C194.639 20.1068 194.162 19.9359 193.792 19.5942C193.436 19.2382 193.258 18.811 193.258 18.3126C193.258 17.8 193.436 17.3728 193.792 17.031C194.162 16.6751 194.639 16.4971 195.223 16.4971C195.792 16.4971 196.255 16.6751 196.611 17.031C196.967 17.3728 197.145 17.8 197.145 18.3126C197.145 18.811 196.967 19.2382 196.611 19.5942C196.255 19.9359 195.792 20.1068 195.223 20.1068ZM198.952 20V9.23488H202.156V20H198.952ZM200.554 7.99604C199.984 7.99604 199.521 7.83229 199.165 7.50478C198.809 7.17727 198.631 6.76432 198.631 6.26593C198.631 5.75331 198.809 5.33324 199.165 5.00573C199.521 4.67822 199.984 4.51447 200.554 4.51447C201.137 4.51447 201.607 4.67822 201.963 5.00573C202.334 5.33324 202.519 5.75331 202.519 6.26593C202.519 6.76432 202.334 7.17727 201.963 7.50478C201.607 7.83229 201.137 7.99604 200.554 7.99604ZM209.614 20.2563C208.574 20.2563 207.642 20.0142 206.816 19.5301C205.99 19.0459 205.335 18.3838 204.851 17.5437C204.367 16.6893 204.124 15.721 204.124 14.6388C204.124 13.5281 204.367 12.5527 204.851 11.7126C205.335 10.8582 205.99 10.1889 206.816 9.70479C207.656 9.22064 208.589 8.97857 209.614 8.97857C210.668 8.97857 211.607 9.22064 212.433 9.70479C213.259 10.1889 213.914 10.8582 214.398 11.7126C214.882 12.5527 215.125 13.521 215.125 14.6174C215.125 15.7139 214.882 16.6893 214.398 17.5437C213.914 18.3838 213.259 19.0459 212.433 19.5301C211.607 20.0142 210.668 20.2563 209.614 20.2563ZM209.614 17.4796C210.041 17.4796 210.418 17.3728 210.746 17.1592C211.088 16.9456 211.358 16.6252 211.557 16.198C211.757 15.7708 211.857 15.244 211.857 14.6174C211.857 13.9909 211.757 13.464 211.557 13.0368C211.358 12.6097 211.095 12.2893 210.767 12.0757C210.44 11.8621 210.062 11.7553 209.635 11.7553C209.208 11.7553 208.823 11.8621 208.482 12.0757C208.154 12.2893 207.891 12.6097 207.691 13.0368C207.492 13.464 207.392 13.9909 207.392 14.6174C207.392 15.244 207.492 15.7708 207.691 16.198C207.891 16.6252 208.154 16.9456 208.482 17.1592C208.823 17.3728 209.201 17.4796 209.614 17.4796Z" fill="white" />
    </svg>
  );
}

// ─── Count-up hook ────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1.4, inView: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, target, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setCount(Math.round(v)),
    });
    return controls.stop;
  }, [inView, target, duration]);
  return count;
}

// ─── NAV ──────────────────────────────────────────────────────────────────────

function Nav() {
  const { scrollY } = useScroll();
  const bg   = useTransform(scrollY, [0, 100], [`rgba(13,13,13,0)`, `rgba(13,13,13,0.95)`]);
  const blur = useTransform(scrollY, [0, 100], ["blur(0px)", "blur(16px)"]);
  const bdr  = useTransform(scrollY, [0, 100], ["rgba(242,237,228,0)", BORDER]);

  return (
    <motion.header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      backgroundColor: bg, backdropFilter: blur,
      borderBottom: "1px solid", borderBottomColor: bdr,
    }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto", padding: "0 48px", height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <motion.div
          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, ease: E1 }}
        >
          <LogoSVG size={22} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.1, ease: E1 }}
          style={{ display: "flex", alignItems: "center", gap: 16 }}
        >
          <span className="spo-hide-mobile" style={{
            fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.14em",
            textTransform: "uppercase", color: TEXT_3,
            padding: "5px 14px", border: `1px solid ${BORDER2}`, borderRadius: 4,
          }}>Exclusivo · Ousen</span>
          <motion.a
            href="#contato"
            whileHover={{ backgroundColor: GREEN_DIM, scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            style={{
              padding: "9px 22px", borderRadius: 6, background: GREEN,
              color: "#0D0D0D", fontFamily: "'DM Sans', sans-serif",
              fontSize: 13, fontWeight: 600, textDecoration: "none",
              letterSpacing: "0.01em",
            }}
          >
            Falar agora
          </motion.a>
        </motion.div>
      </div>
    </motion.header>
  );
}

// ─── HERO ─────────────────────────────────────────────────────────────────────

function Hero() {
  const words1 = ["A Ousen"];
  const words2 = ["vende,"];
  const words3 = ["nós cuidamos"];
  const words4 = ["do resto."];

  const lineVariants = {
    hidden: { opacity: 0, y: 48, skewY: 2 },
    visible: (i: number) => ({
      opacity: 1, y: 0, skewY: 0,
      transition: { delay: 0.2 + i * 0.13, duration: 0.8, ease: E1 },
    }),
  };

  const highlights = [
    { value: "2.900", suffix: "+", desc: "componentes Elementor prontos" },
    { value: "3",     suffix: " dias", desc: "do briefing à página publicada" },
    { value: "600",   prefix: "R$", desc: "por projeto criado" },
    { value: "99",    prefix: "R$", suffix: "/mês", desc: "de acompanhamento contínuo" },
  ];

  return (
    <section style={{ padding: "148px 48px 80px", maxWidth: 1200, margin: "0 auto" }}>
      {/* Top label */}
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: E1 }}
        style={{
          display: "flex", alignItems: "center", gap: 12, marginBottom: 48,
        }}
      >
        <div style={{ width: 28, height: 1, background: GREEN }} />
        <span style={{
          fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.18em",
          textTransform: "uppercase", color: GREEN,
        }}>Studio Partners · Proposta para Ousen</span>
      </motion.div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 80, alignItems: "start" }} className="spo-hero-grid">

        {/* Left — headline */}
        <div>
          <div style={{ overflow: "hidden" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {[[...words1, ...words2], [...words3, ...words4]].map((line, li) => (
                <motion.div
                  key={li}
                  custom={li}
                  variants={lineVariants}
                  initial="hidden"
                  animate="visible"
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontSize: "clamp(44px, 6.5vw, 82px)",
                    fontWeight: 900,
                    lineHeight: 1.02,
                    letterSpacing: "-0.025em",
                    color: li === 1 ? GREEN : TEXT_1,
                    display: "block",
                  }}
                >
                  {line.join(" ")}
                </motion.div>
              ))}
            </div>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.7, ease: E1 }}
            style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 17, color: TEXT_2,
              maxWidth: 560, lineHeight: 1.75, margin: "36px 0 44px",
              fontWeight: 300,
            }}
          >
            A SuperElements entrega páginas Elementor em até 3 dias — com processo definido,
            biblioteca de 2.900+ componentes e um painel centralizado onde a Ousen
            acompanha tudo em tempo real.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.72, duration: 0.6, ease: E1 }}
            style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}
          >
            <motion.a
              href="#solucao"
              whileHover={{ backgroundColor: GREEN_DIM, x: 2 }}
              whileTap={{ scale: 0.97 }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 10,
                padding: "13px 28px", borderRadius: 6, background: GREEN,
                color: "#0D0D0D", fontFamily: "'DM Sans', sans-serif",
                fontSize: 14, fontWeight: 600, textDecoration: "none",
              }}
            >
              Ver como funciona
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 7h10M8 3l4 4-4 4" stroke="#0D0D0D" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </motion.a>
            <motion.a
              href="#preco"
              whileHover={{ color: TEXT_1 }}
              style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: TEXT_2,
                textDecoration: "none", borderBottom: `1px solid ${TEXT_3}`, paddingBottom: 1,
              }}
            >
              Ver preços
            </motion.a>
          </motion.div>
        </div>

        {/* Right — stats card */}
        <motion.div
          className="spo-hero-aside"
          initial={{ opacity: 0, y: 32 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.8, ease: E1 }}
          style={{
            border: `1px solid ${BORDER2}`, borderRadius: 12,
            overflow: "hidden", background: BG2,
            marginTop: 16,
          }}
        >
          <div style={{
            padding: "14px 20px", borderBottom: `1px solid ${BORDER}`,
            fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.16em",
            textTransform: "uppercase", color: TEXT_3,
          }}>O que você ganha</div>

          {highlights.map((h, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.65 + i * 0.09, duration: 0.5 }}
              style={{
                padding: "18px 20px",
                borderBottom: i < highlights.length - 1 ? `1px solid ${BORDER}` : "none",
                display: "flex", flexDirection: "column", gap: 4,
              }}
            >
              <div style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: 28, fontWeight: 700, color: GREEN,
                lineHeight: 1, letterSpacing: "-0.02em",
              }}>
                {h.prefix || ""}{h.value}{h.suffix || ""}
              </div>
              <div style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: TEXT_2,
                fontWeight: 300,
              }}>{h.desc}</div>
            </motion.div>
          ))}

          <div style={{
            padding: "14px 20px", borderTop: `1px solid ${BORDER}`,
            fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: TEXT_3,
            fontStyle: "italic",
          }}>
            Proposta preparada exclusivamente para a equipe Ousen.
          </div>
        </motion.div>
      </div>

      {/* Stats bar */}
      <StatsBar />
    </section>
  );
}

// ─── STATS BAR ────────────────────────────────────────────────────────────────

function StatItem({ target, prefix = "", suffix = "", label }: {
  target: number; prefix?: string; suffix?: string; label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const count = useCountUp(target, 1.6, inView);
  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
      <div style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: "clamp(28px, 3.5vw, 42px)", fontWeight: 700,
        color: TEXT_1, lineHeight: 1, letterSpacing: "-0.03em",
      }}>
        {prefix}{count.toLocaleString("pt-BR")}{suffix}
      </div>
      <div style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: 13,
        color: TEXT_2, fontWeight: 300,
      }}>{label}</div>
    </div>
  );
}

function StatsBar() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease: E1 }}
      style={{
        marginTop: 72,
        padding: "40px 0",
        borderTop: `1px solid ${BORDER}`,
        borderBottom: `1px solid ${BORDER}`,
        display: "flex", gap: 0, flexWrap: "wrap",
      }}
    >
      {[
        { target: 2900, suffix: "+", label: "componentes Elementor" },
        { target: 3,    suffix: " dias úteis", label: "do briefing à entrega" },
        { target: 60,   suffix: "%", label: "de margem líquida por projeto" },
        { target: 100,  suffix: "%", label: "white label, invisível ao cliente final" },
      ].map((s, i) => (
        <React.Fragment key={i}>
          <StatItem {...s} />
          {i < 3 && (
            <div style={{
              width: 1, background: BORDER, margin: "0 40px",
              alignSelf: "stretch",
            }} className="spo-stat-divider" />
          )}
        </React.Fragment>
      ))}
    </motion.div>
  );
}

// ─── SECTION LABEL ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
    }}>
      <div style={{ width: 20, height: 1, background: GREEN }} />
      <span style={{
        fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.16em",
        textTransform: "uppercase", color: GREEN,
      }}>{children}</span>
    </div>
  );
}

// ─── PROCESS SECTION ──────────────────────────────────────────────────────────

const steps = [
  { num: "01", title: "Briefing pelo painel",   desc: "Formulário estruturado direto na ferramenta. Sem reunião, sem e-mail perdido." },
  { num: "02", title: "Produção no Elementor",  desc: "2.900+ componentes prontos. Velocidade e padrão em todo projeto." },
  { num: "03", title: "Revisão e aprovação",    desc: "Uma rodada clara com escopo definido. Tudo registrado no painel." },
  { num: "04", title: "Entrega em até 3 dias",  desc: "Publicada, testada e conectada ao painel. A Ousen apresenta ao cliente." },
  { num: "05", title: "Acompanhamento contínuo", desc: "Monitoramento diário, bugs corrigidos, performance otimizada — sem cobrar." },
];

function ProcessSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="solucao" ref={ref} style={{ padding: "100px 0" }}>
      <div className="spo-section-inner" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px" }}>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 420px", gap: 80 }} className="spo-sol-grid">

          {/* Left */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.7, ease: E1 }}
            >
              <SectionLabel>Como a SuperElements opera</SectionLabel>
              <h2 style={{
                fontFamily: "'Playfair Display', serif",
                fontSize: "clamp(32px, 4.5vw, 56px)", fontWeight: 900,
                lineHeight: 1.04, letterSpacing: "-0.025em", color: TEXT_1,
                margin: "0 0 28px",
              }}>
                Da venda ao ar<br />
                em <em style={{ color: GREEN, fontStyle: "italic" }}>3 dias.</em>
              </h2>
            </motion.div>

            {[
              "A Ousen fecha o contrato. Passa o briefing no painel. O restante é com a gente.",
              "Cada página é construída no Elementor com componentes da nossa biblioteca — 2.900+ blocos prontos, organizados por nicho. Isso elimina o tempo de criação do zero e garante consistência em cada entrega.",
              "E tudo o que acontece no processo aparece no painel SuperElements: briefings, status de cada página, performance, propostas e recursos — num único lugar, em tempo real.",
            ].map((p, i) => (
              <motion.p
                key={i}
                initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.1 + i * 0.1, duration: 0.6, ease: E1 }}
                style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: TEXT_2,
                  lineHeight: 1.8, marginBottom: 18, fontWeight: 300,
                }}
              >{p}</motion.p>
            ))}

            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.42, duration: 0.6, ease: E1 }}
              style={{
                borderLeft: `2px solid ${GREEN}`,
                padding: "20px 24px",
                background: "rgba(210,245,37,0.04)",
                borderRadius: "0 8px 8px 0",
                marginTop: 12,
              }}
            >
              <div style={{
                fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.14em",
                textTransform: "uppercase", color: GREEN, marginBottom: 8,
              }}>White label, de ponta a ponta</div>
              <p style={{
                fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: TEXT_2,
                lineHeight: 1.75, margin: 0, fontWeight: 300,
              }}>
                O cliente final não sabe que a SuperElements existe. A Ousen apresenta,
                a Ousen entrega — nós somos a operação por trás, invisíveis e funcionando.
              </p>
            </motion.div>
          </div>

          {/* Right — process timeline */}
          <motion.div
            initial={{ opacity: 0, y: 32 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.15, duration: 0.8, ease: E1 }}
            className="spo-process-sticky"
            style={{
              position: "sticky", top: 88,
              border: `1px solid ${BORDER2}`,
              borderRadius: 12, overflow: "hidden",
            }}
          >
            <div style={{
              padding: "16px 22px", borderBottom: `1px solid ${BORDER}`,
              fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.14em",
              textTransform: "uppercase", color: TEXT_3, background: BG2,
            }}>Do briefing ao ar</div>

            <div>
              {steps.map((s, i) => (
                <div key={i} style={{
                  display: "flex", gap: 16, alignItems: "flex-start",
                  padding: "16px 22px",
                  borderBottom: i < steps.length - 1 ? `1px solid ${BORDER}` : "none",
                  background: BG2,
                  position: "relative",
                }}>
                  {/* timeline line */}
                  {i < steps.length - 1 && (
                    <div style={{
                      position: "absolute", left: 33, top: 40, bottom: -16,
                      width: 1, background: BORDER,
                    }} />
                  )}
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: BG3, border: `1px solid ${BORDER2}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, position: "relative", zIndex: 1,
                  }}>
                    <span style={{
                      fontFamily: "'DM Mono', monospace", fontSize: 10,
                      fontWeight: 500, color: GREEN, letterSpacing: "0.04em",
                    }}>{s.num}</span>
                  </div>
                  <div style={{ paddingTop: 4 }}>
                    <div style={{
                      fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
                      fontSize: 13, color: TEXT_1, marginBottom: 4,
                    }}>{s.title}</div>
                    <div style={{
                      fontFamily: "'DM Sans', sans-serif", fontSize: 12.5,
                      color: TEXT_2, lineHeight: 1.6, fontWeight: 300,
                    }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              background: GREEN, padding: "16px 22px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <div style={{
                  fontFamily: "'Playfair Display', serif", fontSize: 20,
                  fontWeight: 700, color: "#0D0D0D",
                }}>3 dias úteis</div>
                <div style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 11.5,
                  color: "rgba(0,0,0,0.55)", marginTop: 2, fontWeight: 400,
                }}>do briefing à página no ar</div>
              </div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 12h14M12 5l7 7-7 7" stroke="#0D0D0D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── TOOL FEATURES ────────────────────────────────────────────────────────────

const toolFeatures = [
  {
    num: "A",
    title: "Painel inicial",
    desc: "Visão geral da operação em tempo real: clientes ativos, alertas e acesso rápido a tudo que importa. Sem acessar o site de cada cliente.",
  },
  {
    num: "B",
    title: "Todos os clientes num lugar",
    desc: "Veja todos os clientes, páginas ativas, score de performance e status — sem planilha, sem grupo de WhatsApp.",
  },
  {
    num: "C",
    title: "Todas as páginas de um cliente",
    desc: "Acesse cada site da conta com URLs, score de performance por página e status de publicação — tudo centralizado.",
  },
  {
    num: "D",
    title: "1.900+ componentes Elementor",
    desc: "Biblioteca filtrada por nicho e categoria. A produção começa com o bloco certo, não do zero — isso é o que garante 3 dias.",
  },
];

function ToolSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} style={{ padding: "80px 0 60px" }}>
      <div className="spo-section-inner" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px" }}>

        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 80, alignItems: "start" }} className="spo-tool-grid">

          {/* Left sticky */}
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, ease: E1 }}
            style={{ position: "sticky", top: 88 }}
            className="spo-tool-sticky"
          >
            <SectionLabel>O painel SuperElements</SectionLabel>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 900,
              lineHeight: 1.05, letterSpacing: "-0.025em", color: TEXT_1,
              margin: "0 0 20px",
            }}>
              Tudo que importa,<br />
              <em style={{ color: GREEN, fontStyle: "italic" }}>num único lugar.</em>
            </h2>
            <p style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 15.5, color: TEXT_2,
              lineHeight: 1.75, fontWeight: 300,
            }}>
              A ferramenta que desenvolvemos centraliza toda a operação: clientes,
              páginas, propostas e componentes — acessíveis em tempo real, sem planilha, sem WhatsApp.
            </p>
          </motion.div>

          {/* Right — feature cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {toolFeatures.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 24 }} animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.08 + i * 0.1, duration: 0.65, ease: E1 }}
                style={{
                  padding: "28px 32px",
                  borderBottom: i < toolFeatures.length - 1 ? `1px solid ${BORDER}` : "none",
                  display: "flex", gap: 24, alignItems: "flex-start",
                }}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  border: `1px solid ${BORDER2}`, background: BG2,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <span style={{
                    fontFamily: "'DM Mono', monospace", fontSize: 12,
                    fontWeight: 500, color: GREEN,
                  }}>{f.num}</span>
                </div>
                <div>
                  <div style={{
                    fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
                    fontSize: 15, color: TEXT_1, marginBottom: 8,
                  }}>{f.title}</div>
                  <div style={{
                    fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                    color: TEXT_2, lineHeight: 1.7, fontWeight: 300,
                  }}>{f.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Product mockups */}
        <div style={{ marginTop: 80 }}>
          <ProductShowcase />
        </div>
      </div>
    </section>
  );
}

// ─── PRODUCT MOCKUPS ──────────────────────────────────────────────────────────

const L_BG      = "#f7f7f8";
const L_WHITE   = "#ffffff";
const L_BORDER  = "#e5e7eb";
const L_TEXT1   = "#111827";
const L_TEXT2   = "#6b7280";
const L_TEXT3   = "#9ca3af";
const L_GREEN   = "#D2F525";

const FRAME_W = 860;
const FRAME_H = 420;

const REAL_NAV = [
  "Início", "Clientes", "Propostas", "Recursos", "Componentes",
];

function ProductSidebar({ activeItem }: { activeItem: string }) {
  return (
    <div style={{
      width: 155, background: L_WHITE, borderRight: `1px solid ${L_BORDER}`,
      display: "flex", flexDirection: "column", flexShrink: 0,
    }} className="spo-dash-sidebar">
      <div style={{ padding: "12px 12px 10px", borderBottom: `1px solid ${L_BORDER}` }}>
        <LogoSVG size={20} />
      </div>
      <nav style={{ padding: "8px 8px", flex: 1 }}>
        {REAL_NAV.map(item => {
          const isActive = item === activeItem;
          return (
            <div key={item} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "7px 10px", borderRadius: 8, marginBottom: 2,
              background: isActive ? L_GREEN : "transparent",
              color: isActive ? "#111" : L_TEXT2,
              fontSize: 13, fontWeight: isActive ? 600 : 400,
              fontFamily: "'DM Sans', sans-serif",
            }}>{item}</div>
          );
        })}
      </nav>
      <div style={{
        margin: "8px", padding: "10px 12px", borderRadius: 10,
        border: `1px solid ${L_BORDER}`, background: L_BG,
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: L_TEXT3, marginBottom: 4, fontFamily: "'DM Mono', monospace" }}>WORKSPACE</div>
        <div style={{ color: L_TEXT1, fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans', sans-serif" }}>Ousen</div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
          <span style={{ color: "#22c55e", fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans', sans-serif" }}>Ativo</span>
        </div>
      </div>
    </div>
  );
}

function ChromeBar({ url }: { url: string }) {
  return (
    <div style={{
      background: "#f0f0f0", padding: "8px 14px",
      display: "flex", alignItems: "center", gap: 10,
      borderBottom: `1px solid ${L_BORDER}`,
    }}>
      <div style={{ display: "flex", gap: 5 }}>
        {["#ff5f57","#ffbd2e","#28c840"].map(c => (
          <div key={c} style={{ width: 10, height: 10, borderRadius: "50%", background: c }} />
        ))}
      </div>
      <div style={{
        flex: 1, background: "white", borderRadius: 5, border: `1px solid ${L_BORDER}`,
        padding: "3px 12px", fontSize: 11, color: L_TEXT3, fontFamily: "'DM Mono', monospace",
      }}>{url}</div>
    </div>
  );
}

function ScaledScreen({ url, activeItem, children }: {
  url: string; activeItem: string; children: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => {
      const available = el.offsetWidth;
      setScale(available >= FRAME_W ? 1 : available / FRAME_W);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} style={{ width: "100%", height: Math.round(FRAME_H * scale), overflow: "hidden", borderRadius: 12, position: "relative" }}>
      <div style={{
        width: FRAME_W, height: FRAME_H,
        transform: `scale(${scale})`, transformOrigin: "top left",
        borderRadius: 12, border: `1px solid ${L_BORDER}`, overflow: "hidden",
        boxShadow: "0 16px 48px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.08)",
        display: "flex", flexDirection: "column",
      }}>
        <ChromeBar url={url} />
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <ProductSidebar activeItem={activeItem} />
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ShowcaseRowProps {
  eyebrow: string;
  title: string;
  desc: string;
  tags: string[];
  url: string;
  activeItem: string;
  children: React.ReactNode;
  flip?: boolean;
}

function ShowcaseRow({ eyebrow, title, desc, tags, url, activeItem, children, flip = false }: ShowcaseRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const contentCol = (
    <motion.div
      initial={{ opacity: 0, x: flip ? 28 : -28 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.7, ease: E1 }}
      className="spo-showcase-content"
      style={{
        width: 260, flexShrink: 0, display: "flex", flexDirection: "column",
        justifyContent: "center", gap: 12,
        paddingRight: flip ? 0 : 0, paddingLeft: flip ? 0 : 0,
      }}
    >
      <div style={{
        fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.14em",
        textTransform: "uppercase", color: GREEN,
      }}>{eyebrow}</div>
      <h3 style={{
        fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700,
        color: TEXT_1, lineHeight: 1.2, letterSpacing: "-0.02em", margin: 0,
      }}>{title}</h3>
      <p style={{
        fontFamily: "'DM Sans', sans-serif", fontSize: 13.5, color: TEXT_2,
        lineHeight: 1.7, margin: 0, fontWeight: 300,
      }}>{desc}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {tags.map(t => (
          <span key={t} style={{
            padding: "3px 10px", borderRadius: 999,
            border: `1px solid ${BORDER2}`, background: BG3,
            fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: TEXT_2,
          }}>{t}</span>
        ))}
      </div>
    </motion.div>
  );

  const screenCol = (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: E1, delay: 0.1 }}
      style={{ flex: 1, minWidth: 0 }}
    >
      <ScaledScreen url={url} activeItem={activeItem}>
        {children}
      </ScaledScreen>
    </motion.div>
  );

  return (
    <div
      ref={ref}
      className="spo-showcase-row"
      style={{ display: "flex", alignItems: "center", gap: 48, flexDirection: flip ? "row-reverse" : "row" }}
    >
      {contentCol}
      {screenCol}
    </div>
  );
}

function MockupInicio() {
  const stats = [
    { label: "Total de Clientes", value: "8", noteRed: false },
    { label: "Conectados",        value: "5", noteRed: false },
    { label: "Com Problema",      value: "1", noteRed: true },
    { label: "Propostas Ativas",  value: "5", noteRed: false },
  ];
  const clients = [
    { name: "Dra. Camila Mendes",           url: "camilamendes-adv.com.br",  pages: "2 páginas",  date: "18/02/2024", status: "Erro",         statusColor: "#ef4444", statusBg: "#fef2f2" },
    { name: "Lima Tributário Consultores",   url: "limatributario.com.br",    pages: "—",          date: "10/02/2024", status: "Desconectado", statusColor: L_TEXT3,  statusBg: L_BG },
    { name: "Barbosa Advocacia Trabalhista", url: "barbosatrabalhista.com.br", pages: "—",         date: "Nunca testado", status: "Conectando...", statusColor: "#f59e0b", statusBg: "#fffbeb" },
    { name: "Dr. João Advogados",            url: "dr-joao-advogados.com.br", pages: "5 páginas", date: "20/02/2024", status: "Conectado",    statusColor: "#16a34a", statusBg: "#f0fdf4" },
    { name: "Escritório Silva & Associados", url: "escritorio-silva.com.br",  pages: "3 páginas", date: "20/02/2024", status: "Conectado",    statusColor: "#16a34a", statusBg: "#f0fdf4" },
  ];
  return (
    <div style={{ flex: 1, background: L_BG, overflow: "hidden", padding: "20px 24px", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: L_WHITE, borderRadius: 16, padding: "16px 20px", marginBottom: 16, border: `1px solid ${L_BORDER}` }}>
        <div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: L_TEXT1 }}>Boa tarde, Ousen</div>
          <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: L_TEXT2, marginTop: 2 }}>Visão geral da sua operação</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${L_BORDER}`, background: L_WHITE, fontSize: 12, fontWeight: 500, color: L_TEXT2, fontFamily: "'DM Sans', sans-serif" }}>Clientes</div>
          <div style={{ padding: "6px 12px", borderRadius: 8, background: L_GREEN, fontSize: 12, fontWeight: 600, color: "#111", fontFamily: "'DM Sans', sans-serif" }}>+ Novo Cliente</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
        {stats.map((s, i) => (
          <div key={i} style={{
            background: i === 2 ? "#fef2f2" : L_WHITE,
            border: `1px solid ${i === 2 ? "#fca5a5" : L_BORDER}`,
            borderRadius: 12, padding: "14px 16px",
          }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: L_TEXT2, marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 26, fontWeight: 800, color: i === 2 ? "#ef4444" : i === 1 ? "#16a34a" : L_TEXT1, lineHeight: 1 }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: L_WHITE, borderRadius: 16, border: `1px solid ${L_BORDER}`, overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${L_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, color: L_TEXT1 }}>Carteira de Clientes</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: L_TEXT2, marginTop: 1 }}>1 conta precisando de atenção</div>
          </div>
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: L_TEXT2 }}>Ver todos →</span>
        </div>
        {clients.map((c, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", padding: "10px 18px", borderBottom: i < clients.length - 1 ? `1px solid ${L_BORDER}` : "none", gap: 12 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: c.statusColor, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: L_TEXT1 }}>{c.name}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 10, color: L_TEXT3, marginTop: 1 }}>{c.url}</div>
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: L_TEXT3, flexShrink: 0 }}>{c.pages}</div>
            <div style={{ padding: "2px 10px", borderRadius: 999, background: c.statusBg, color: c.statusColor, fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", border: `1px solid ${c.statusColor}33`, flexShrink: 0 }}>{c.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockupClientes() {
  const clients = [
    { name: "Dr. João Advogados",           url: "dr-joao-advogados.com.br",  area: "Dir. Trabalhista", pages: 5,  score: 94, status: "Conectado", sc: "#16a34a", sb: "#f0fdf4" },
    { name: "Escritório Silva & Associados", url: "escritorio-silva.com.br",   area: "Dir. Civil",       pages: 3,  score: 92, status: "Conectado", sc: "#16a34a", sb: "#f0fdf4" },
    { name: "Torres Advocacia Criminal",     url: "advocacia-torres.com",      area: "Dir. Criminal",    pages: 8,  score: 93, status: "Conectado", sc: "#16a34a", sb: "#f0fdf4" },
    { name: "Ramos & Ramos Previdenciário",  url: "ramosprevidenciario.adv.br", area: "Previdenciário",  pages: 6,  score: 90, status: "Conectado", sc: "#16a34a", sb: "#f0fdf4" },
    { name: "Ferreira Direito de Família",   url: "ferreirafamilia.adv.br",    area: "Dir. Família",     pages: 4,  score: 97, status: "Conectado", sc: "#16a34a", sb: "#f0fdf4" },
    { name: "Dra. Camila Mendes",            url: "camilamendes-adv.com.br",   area: "Dir. Família",     pages: 2,  score: null, status: "Erro",   sc: "#ef4444", sb: "#fef2f2" },
    { name: "Barbosa Advocacia Trabalhista", url: "barbosatrabalhista.com.br", area: "Dir. Trabalhista", pages: null, score: null, status: "Conectando...", sc: "#f59e0b", sb: "#fffbeb" },
    { name: "Lima Tributário Consultores",   url: "limatributario.com.br",     area: "Dir. Tributário",  pages: null, score: null, status: "Desconectado", sc: L_TEXT3, sb: L_BG },
  ];
  return (
    <div style={{ flex: 1, background: L_BG, overflow: "hidden", padding: "20px 24px", height: "100%" }}>
      <div style={{ background: L_WHITE, borderRadius: 16, border: `1px solid ${L_BORDER}`, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${L_BORDER}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: L_TEXT1 }}>Clientes</div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: L_TEXT2, marginTop: 2 }}>8 contas · 5 conectadas</div>
          </div>
          <div style={{ padding: "6px 14px", borderRadius: 8, background: L_GREEN, fontSize: 12, fontWeight: 600, color: "#111", fontFamily: "'DM Sans', sans-serif" }}>+ Novo</div>
        </div>
        <div style={{ padding: "10px 16px", borderBottom: `1px solid ${L_BORDER}`, background: L_BG }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: L_WHITE, border: `1px solid ${L_BORDER}`, borderRadius: 8, padding: "6px 12px" }}>
            <span style={{ color: L_TEXT3, fontSize: 12 }}>🔍</span>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: L_TEXT3 }}>Buscar cliente...</span>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "200px 130px 70px 80px 120px", padding: "8px 20px", background: L_BG, borderBottom: `1px solid ${L_BORDER}` }}>
          {["Cliente", "Área", "Páginas", "Score", "Status"].map(h => (
            <div key={h} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, color: L_TEXT3, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</div>
          ))}
        </div>
        {clients.map((c, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "200px 130px 70px 80px 120px", padding: "10px 20px", alignItems: "center", borderBottom: i < clients.length - 1 ? `1px solid ${L_BORDER}` : "none", background: i % 2 === 0 ? L_WHITE : "#fafafa" }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: L_TEXT1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: L_TEXT3, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.url}</div>
            </div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: L_TEXT2, whiteSpace: "nowrap" }}>{c.area}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 600, color: L_TEXT1 }}>{c.pages ?? "—"}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: c.score && c.score >= 90 ? "#16a34a" : c.score ? "#f59e0b" : L_TEXT3 }}>{c.score ? `${c.score}` : "—"}</div>
            <div style={{ padding: "3px 10px", borderRadius: 999, background: c.sb, color: c.sc, fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", display: "inline-flex", alignItems: "center", border: `1px solid ${c.sc}33`, whiteSpace: "nowrap", width: "fit-content" }}>{c.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockupClienteDetalhe() {
  const pages = [
    { title: "Home",               slug: "advocacia-torres.com",                   score: 96, status: "Publicada" },
    { title: "Direito Criminal",   slug: "advocacia-torres.com/direito-criminal",  score: 93, status: "Publicada" },
    { title: "Habeas Corpus",      slug: "advocacia-torres.com/habeas-corpus",     score: 91, status: "Publicada" },
    { title: "Sobre o Escritório", slug: "advocacia-torres.com/sobre",             score: 88, status: "Publicada" },
    { title: "Áreas de Atuação",  slug: "advocacia-torres.com/areas-de-atuacao", score: 87, status: "Publicada" },
    { title: "Blog Jurídico",     slug: "advocacia-torres.com/blog",              score: 85, status: "Publicada" },
    { title: "Contato",           slug: "advocacia-torres.com/contato",           score: 90, status: "Publicada" },
    { title: "Depoimentos",       slug: "advocacia-torres.com/depoimentos",       score: 92, status: "Publicada" },
  ];
  const scoreColor = (s: number) => s >= 90 ? "#16a34a" : s >= 80 ? "#f59e0b" : "#ef4444";
  const scoreBg    = (s: number) => s >= 90 ? "#f0fdf4" : s >= 80 ? "#fffbeb" : "#fef2f2";
  return (
    <div style={{ flex: 1, background: L_BG, overflow: "hidden", padding: "20px 24px", height: "100%" }}>
      <div style={{ background: L_WHITE, borderRadius: 16, border: `1px solid ${L_BORDER}`, padding: "16px 20px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#3b1f1f", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontSize: 14 }}>⚖</span>
          </div>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: L_TEXT1 }}>Torres Advocacia Criminal</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: L_TEXT2, marginTop: 1 }}>advocacia-torres.com · 8 páginas ativas</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ padding: "2px 10px", borderRadius: 999, background: "#f0fdf4", color: "#16a34a", fontSize: 10, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", border: "1px solid #16a34a33" }}>Conectado</div>
          <div style={{ padding: "5px 12px", borderRadius: 8, background: L_GREEN, fontSize: 11, fontWeight: 600, color: "#111", fontFamily: "'DM Sans', sans-serif" }}>+ Página</div>
        </div>
      </div>
      <div style={{ background: L_WHITE, borderRadius: 16, border: `1px solid ${L_BORDER}`, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr 90px 100px", padding: "8px 20px", background: L_BG, borderBottom: `1px solid ${L_BORDER}` }}>
          {["Página", "URL", "Score", "Status"].map(h => (
            <div key={h} style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, color: L_TEXT3, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</div>
          ))}
        </div>
        {pages.map((p, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "140px 1fr 90px 100px", padding: "10px 20px", alignItems: "center", borderBottom: i < pages.length - 1 ? `1px solid ${L_BORDER}` : "none", background: i % 2 === 0 ? L_WHITE : "#fafafa" }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: L_TEXT1, whiteSpace: "nowrap" }}>{p.title}</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: L_TEXT3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{p.slug}</div>
            <div>
              <div style={{ padding: "3px 9px", borderRadius: 999, display: "inline-flex", alignItems: "center", background: scoreBg(p.score), color: scoreColor(p.score), fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono', monospace", border: `1px solid ${scoreColor(p.score)}33` }}>{p.score}</div>
            </div>
            <div style={{ padding: "3px 10px", borderRadius: 999, background: "#f0fdf4", color: "#16a34a", fontSize: 10, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", display: "inline-flex", alignItems: "center", border: "1px solid #16a34a33", width: "fit-content" }}>{p.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockupComponentes() {
  const [activeFilter, setActiveFilter] = useState("Jurídico");
  const filters = ["Todos", "Hero", "CTA", "Formulários", "Depoimentos", "FAQ", "Jurídico"];
  const components = [
    { name: "Hero — Advogado Dark",       cat: "Hero",        preview: "linear-gradient(135deg,#1a1a2e,#16213e)" },
    { name: "CTA — Consulta Gratuita",    cat: "CTA",         preview: "linear-gradient(135deg,#0f3460,#533483)" },
    { name: "Form — Lead Jurídico",       cat: "Formulários", preview: "linear-gradient(135deg,#1b1b2f,#162447)" },
    { name: "Depoimentos — Resultados",   cat: "Depoimentos", preview: "linear-gradient(135deg,#2c2c54,#474787)" },
    { name: "FAQ — Dúvidas Jurídicas",    cat: "FAQ",         preview: "linear-gradient(135deg,#1a1a1a,#2d2d2d)" },
    { name: "Área de Prática — Cards",    cat: "Jurídico",    preview: "linear-gradient(135deg,#0d0d0d,#1a1a1a)" },
    { name: "Hero — Advogado Light",      cat: "Hero",        preview: "linear-gradient(135deg,#f5f5f5,#e8e8e8)" },
    { name: "Seção Sobre — Perfil",       cat: "Jurídico",    preview: "linear-gradient(135deg,#f0fdf4,#dcfce7)" },
    { name: "Contato — Mapa + Form",      cat: "Formulários", preview: "linear-gradient(135deg,#eff6ff,#dbeafe)" },
  ];
  return (
    <div style={{ flex: 1, background: L_BG, overflow: "hidden", padding: "20px 24px", height: "100%" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: L_TEXT1 }}>Biblioteca de Componentes</div>
        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: L_TEXT2, marginTop: 2 }}>1.900+ componentes prontos para Elementor · filtrados por nicho</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {filters.map(f => (
          <button key={f} onClick={() => setActiveFilter(f)} style={{
            padding: "4px 12px", borderRadius: 999, border: "none",
            background: f === activeFilter ? L_GREEN : L_WHITE,
            color: f === activeFilter ? "#111" : L_TEXT2,
            fontSize: 11, fontWeight: f === activeFilter ? 700 : 500,
            cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            boxShadow: `0 0 0 1px ${f === activeFilter ? "transparent" : L_BORDER}`,
          }}>{f}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {components.map((c, i) => (
          <div key={i} style={{ borderRadius: 10, border: `1px solid ${L_BORDER}`, overflow: "hidden", background: L_WHITE }}>
            <div style={{ height: 64, background: c.preview, position: "relative" }}>
              <div style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.35)", borderRadius: 4, padding: "2px 7px", fontSize: 9, color: "rgba(255,255,255,0.8)", fontFamily: "'DM Mono', monospace" }}>{c.cat}</div>
            </div>
            <div style={{ padding: "8px 10px" }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, color: L_TEXT1 }}>{c.name}</div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 5 }}>
                <div style={{ padding: "2px 8px", borderRadius: 5, background: L_GREEN, fontSize: 9, fontWeight: 700, color: "#111", fontFamily: "'DM Sans', sans-serif" }}>Usar</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductShowcase() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 80 }}>
      <ShowcaseRow
        eyebrow="01 · Visão geral"
        title="Painel inicial"
        desc="Toda a operação em tempo real. Alertas automáticos, status de conexão e acesso rápido a cada cliente."
        tags={["Visão geral", "Alertas automáticos", "Acesso rápido"]}
        url="app.superelements.io/inicio"
        activeItem="Início"
      >
        <MockupInicio />
      </ShowcaseRow>

      <ShowcaseRow
        eyebrow="02 · Clientes"
        title="Todos os clientes num lugar"
        desc="Score de performance, domínio, área de atuação e status — sem planilha, sem WhatsApp."
        tags={["Score de performance", "Status de conexão", "Filtros"]}
        url="app.superelements.io/clientes"
        activeItem="Clientes"
        flip
      >
        <MockupClientes />
      </ShowcaseRow>

      <ShowcaseRow
        eyebrow="03 · Páginas"
        title="Todas as páginas de um cliente"
        desc="URLs indexadas, score por página e status de publicação — tudo sincronizado diariamente."
        tags={["URLs indexadas", "Score por página", "Sincronização diária"]}
        url="app.superelements.io/clientes/torres-advocacia"
        activeItem="Clientes"
      >
        <MockupClienteDetalhe />
      </ShowcaseRow>

      <ShowcaseRow
        eyebrow="04 · Componentes"
        title="1.900+ componentes Elementor"
        desc="Biblioteca filtrada por nicho. A produção começa com o bloco certo — não do zero."
        tags={["Filtros por nicho", "Pronto para usar", "Atualizado semanalmente"]}
        url="app.superelements.io/componentes"
        activeItem="Componentes"
        flip
      >
        <MockupComponentes />
      </ShowcaseRow>
    </div>
  );
}

// ─── PRICING ──────────────────────────────────────────────────────────────────

function PricingSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  const criacaoTags = ["Elementor", "Design responsivo", "Revisões inclusas", "White label", "3 dias"];
  const acompTags   = ["Monitoramento diário", "Correção de bugs", "Otimização de performance", "Ajustes de copy", "Relatório de métricas", "Suporte WhatsApp", "Até 10 projetos"];

  return (
    <section id="preco" ref={ref} style={{ padding: "100px 0" }}>
      <div className="spo-section-inner" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px" }}>

        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: E1 }}
          style={{ marginBottom: 56 }}
        >
          <SectionLabel>Investimento</SectionLabel>
          <h2 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(32px, 4.5vw, 58px)", fontWeight: 900,
            lineHeight: 1.03, letterSpacing: "-0.025em", color: TEXT_1,
            margin: "0 0 20px",
          }}>
            Custo previsível.<br />
            <em style={{ color: GREEN, fontStyle: "italic" }}>Margem garantida.</em>
          </h2>
          <p style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: TEXT_2,
            maxWidth: 520, lineHeight: 1.75, fontWeight: 300,
          }}>
            Modelo simples: a Ousen sabe exatamente quanto vai pagar antes de fechar
            cada contrato — e embolsa a diferença sem tocar na produção.
          </p>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 24 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.12, duration: 0.7, ease: E1 }}
          style={{ border: `1px solid ${BORDER2}`, borderRadius: 12, overflow: "hidden", marginBottom: 24 }}
        >
          {/* Header */}
          <div className="spo-price-header" style={{
            display: "grid", gridTemplateColumns: "1fr 2fr 140px",
            background: BG3, borderBottom: `1px solid ${BORDER}`,
          }}>
            {[
              { label: "Entregável" },
              { label: "O que está incluso", cls: "spo-price-col-hd-tags" },
              { label: "Valor" },
            ].map(({ label, cls }, i) => (
              <div key={label} className={cls} style={{
                padding: "12px 20px",
                fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 500,
                letterSpacing: "0.14em", textTransform: "uppercase",
                color: TEXT_3, textAlign: i === 2 ? "center" : "left",
                borderLeft: i > 0 ? `1px solid ${BORDER}` : "none",
              }}>{label}</div>
            ))}
          </div>

          {[
            { name: "Criação de página",     tags: criacaoTags, price: "R$ 600", period: "por página" },
            { name: "Acompanhamento mensal", tags: acompTags,   price: "R$ 99",  period: "por mês" },
          ].map((row, ri) => (
            <motion.div
              key={row.name}
              className="spo-price-table-grid"
              whileHover={{ backgroundColor: BG3 }}
              style={{
                display: "grid", gridTemplateColumns: "1fr 2fr 140px",
                background: ri % 2 === 0 ? BG : BG2,
                borderBottom: ri === 0 ? `1px solid ${BORDER}` : "none",
                transition: "background 0.15s",
              }}
            >
              <div style={{ padding: "20px 20px", display: "flex", alignItems: "flex-start" }}>
                <span style={{
                  fontFamily: "'DM Sans', sans-serif", fontSize: 14,
                  fontWeight: 600, color: TEXT_1,
                }}>{row.name}</span>
              </div>
              <div className="spo-price-col-tags" style={{ padding: "18px 20px", borderLeft: `1px solid ${BORDER}`, display: "flex", flexWrap: "wrap", gap: 5, alignContent: "flex-start" }}>
                {row.tags.map(tag => (
                  <span key={tag} style={{
                    padding: "3px 10px", borderRadius: 100,
                    border: `1px solid ${BORDER2}`, background: BG3,
                    fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: TEXT_2,
                  }}>{tag}</span>
                ))}
              </div>
              <div style={{
                padding: "20px 20px", borderLeft: `1px solid ${BORDER}`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
                <span style={{
                  fontFamily: "'Playfair Display', serif", fontSize: 24,
                  color: GREEN, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.02em",
                }}>{row.price}</span>
                <span style={{
                  fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.06em",
                  color: TEXT_3, marginTop: 4,
                }}>{row.period}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Margin callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.22, duration: 0.7, ease: E1 }}
          style={{
            background: GREEN, borderRadius: 12, padding: "36px 44px",
            display: "grid", gridTemplateColumns: "1fr auto", gap: 40, alignItems: "center",
          }}
          className="spo-margin-grid"
        >
          <div>
            <div style={{
              fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: "0.14em",
              textTransform: "uppercase", color: "rgba(0,0,0,0.4)", marginBottom: 14,
            }}>Como a margem funciona</div>
            <p style={{
              fontFamily: "'Playfair Display', serif", fontWeight: 700,
              fontSize: "clamp(18px, 2.5vw, 24px)", color: "#0D0D0D",
              lineHeight: 1.3, margin: "0 0 12px",
            }}>
              Ousen cobra R$1.500 → paga R$600 pra nós
            </p>
            <p style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 15, lineHeight: 1.7,
              color: "rgba(0,0,0,0.58)", margin: 0, fontWeight: 300,
            }}>
              Fica com <strong style={{ color: "#0D0D0D", fontWeight: 600 }}>R$900 líquido por página</strong> — sem tocar na produção,
              sem gerenciar designer, sem preocupação com prazo.
            </p>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{
              fontFamily: "'Playfair Display', serif", fontSize: "clamp(52px, 6vw, 72px)",
              fontWeight: 900, color: "#0D0D0D", lineHeight: 1, letterSpacing: "-0.04em",
            }}>60%</div>
            <div style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 12,
              color: "rgba(0,0,0,0.5)", marginTop: 6, fontWeight: 300,
            }}>de margem líquida<br />por página</div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────────────────────

function CTASection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="contato" ref={ref} style={{ padding: "80px 0 120px" }}>
      <div className="spo-section-inner" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px" }}>
        <motion.div
          initial={{ opacity: 0, y: 28 }} animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: E1 }}
          style={{
            border: `1px solid ${BORDER2}`, borderRadius: 16, padding: "64px 72px",
            background: BG2, position: "relative", overflow: "hidden",
            textAlign: "center",
          }}
          className="spo-cta-pad"
        >
          {/* Background accent */}
          <div style={{
            position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)",
            width: 400, height: 400, borderRadius: "50%",
            background: `radial-gradient(circle, ${GREEN}14 0%, transparent 70%)`,
            pointerEvents: "none",
          }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <SectionLabel>Pronto para começar?</SectionLabel>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "clamp(32px, 4.5vw, 56px)", fontWeight: 900,
              lineHeight: 1.05, letterSpacing: "-0.025em", color: TEXT_1,
              margin: "0 0 20px", maxWidth: 640, marginLeft: "auto", marginRight: "auto",
            }}>
              Comece agora e entregue<br />
              <em style={{ color: GREEN, fontStyle: "italic" }}>a primeira página em 3 dias.</em>
            </h2>
            <p style={{
              fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: TEXT_2,
              maxWidth: 480, lineHeight: 1.75, fontWeight: 300,
              margin: "0 auto 40px",
            }}>
              Proposta exclusiva para a Ousen. Basta um briefing para a operação começar.
            </p>

            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <motion.a
                href="https://wa.me/5511999999999"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ backgroundColor: GREEN_DIM, scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  padding: "14px 32px", borderRadius: 8, background: GREEN,
                  color: "#0D0D0D", fontFamily: "'DM Sans', sans-serif",
                  fontSize: 15, fontWeight: 600, textDecoration: "none",
                  letterSpacing: "0.01em",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#0D0D0D">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                Falar via WhatsApp
              </motion.a>
              <motion.a
                href="#solucao"
                whileHover={{ color: TEXT_1, borderColor: BORDER2 }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "14px 28px", borderRadius: 8,
                  border: `1px solid ${BORDER}`,
                  color: TEXT_2, fontFamily: "'DM Sans', sans-serif",
                  fontSize: 15, fontWeight: 400, textDecoration: "none",
                }}
              >
                Ver como funciona
              </motion.a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{
      borderTop: `1px solid ${BORDER}`,
      padding: "28px 0",
    }}>
      <div className="spo-footer" style={{
        maxWidth: 1200, margin: "0 auto", padding: "0 48px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <LogoSVG size={18} />
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <span style={{
            fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: "0.1em",
            color: TEXT_3, textTransform: "uppercase",
          }}>Proposta exclusiva · Ousen × SuperElements · 2026</span>
        </div>
      </div>
    </footer>
  );
}

// ─── GLOBAL CSS ───────────────────────────────────────────────────────────────

const GLOBAL_CSS = `
  #sp-ousen-root *, #sp-ousen-root *::before, #sp-ousen-root *::after {
    box-sizing: border-box;
  }
  #sp-ousen-root {
    overflow-x: hidden;
  }

  @media (max-width: 960px) {
    .spo-hero-grid     { grid-template-columns: 1fr !important; }
    .spo-hero-aside    { display: none !important; }
    .spo-sol-grid      { grid-template-columns: 1fr !important; gap: 40px !important; }
    .spo-tool-grid     { grid-template-columns: 1fr !important; gap: 40px !important; }
    .spo-tool-sticky   { position: static !important; }
    .spo-process-sticky { position: static !important; }
    .spo-closing-grid  { grid-template-columns: 1fr !important; gap: 40px !important; }
    .spo-margin-grid   { grid-template-columns: 1fr !important; }
    .spo-hide-mobile   { display: none !important; }
    .spo-stat-divider  { display: none !important; }
    .spo-cta-pad       { padding: 40px 28px !important; }

    .spo-showcase-row {
      flex-direction: column !important;
      align-items: stretch !important;
      gap: 24px !important;
    }
    .spo-showcase-content {
      width: 100% !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
    }

    .spo-section-inner { padding-left: 24px !important; padding-right: 24px !important; }
    .spo-hero-section  { padding: 110px 24px 60px !important; }
    .spo-footer        { padding-left: 24px !important; padding-right: 24px !important; }

    .spo-price-table-grid  { grid-template-columns: 1fr 110px !important; }
    .spo-price-col-tags    { display: none !important; }
    .spo-price-header      { grid-template-columns: 1fr 110px !important; }
    .spo-price-col-hd-tags { display: none !important; }
  }

  @media (max-width: 700px) {
    .spo-dash-sidebar { display: none !important; }
  }
`;

// ─── PAGE ROOT ────────────────────────────────────────────────────────────────

export default function StudioPartnersOusen() {
  useEffect(() => {
    // Inject fonts
    if (!document.getElementById("sp-ousen-fonts")) {
      const div = document.createElement("div");
      div.innerHTML = FONT_LINK;
      Array.from(div.querySelectorAll("link")).forEach(link => {
        link.id = "sp-ousen-fonts";
        document.head.appendChild(link);
      });
    }

    // Inject styles
    const el = document.createElement("style");
    el.id = "sp-ousen-styles";
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);

    return () => {
      document.getElementById("sp-ousen-styles")?.remove();
    };
  }, []);

  return (
    <div
      id="sp-ousen-root"
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT_1,
        fontFamily: "'DM Sans', sans-serif",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
    >
      <Nav />
      <Hero />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px" }}>
        <div style={{ height: 1, background: BORDER }} />
      </div>

      <ProcessSection />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px" }}>
        <div style={{ height: 1, background: BORDER }} />
      </div>

      <ToolSection />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 48px" }}>
        <div style={{ height: 1, background: BORDER }} />
      </div>

      <PricingSection />

      <CTASection />

      <Footer />
    </div>
  );
}
