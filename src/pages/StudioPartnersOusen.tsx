/**
 * StudioPartnersOusen.tsx — Landing page "Studio Partners"
 * Rota: /studio-partners-ousen
 * Design: alinhado à identidade visual da SuperElements.io
 * Verde: #D2F525 · Fundo: #0f0f0f (dark) ou branco · Fonte: Inter
 */

import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from "framer-motion";

// ─── Tokens ───────────────────────────────────────────────────────────────────

// Cores reais da SuperElements
const GREEN      = "#D2F525";   // verde-limão primário (logo)
const GREEN_DIM  = "#b8d91f";   // hover do verde
const GREEN_BG   = "rgba(210,245,37,0.10)"; // fundo suave verde

// Dark background (inspirado no produto real)
const BG         = "#0f0f0f";
const BG2        = "#141414";
const BG3        = "#1a1a1a";
const BG4        = "#1f1f1f";

// Texto
const TEXT_1     = "#f5f5f5";   // primary
const TEXT_2     = "#a1a1a1";   // secondary
const TEXT_3     = "#555555";   // muted

// Bordas
const BORDER     = "rgba(255,255,255,0.07)";
const BORDER2    = "rgba(255,255,255,0.12)";

const E1 = [0.22, 1, 0.36, 1] as const;
const E2 = [0.25, 0.46, 0.45, 0.94] as const;

// ─── Logo SVG real da SuperElements ───────────────────────────────────────────

function LogoSVG({ size = 28 }: { size?: number }) {
  const scale = size / 28;
  return (
    <svg
      width={Math.round(217 * scale)}
      height={size}
      viewBox="0 0 217 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="27.7511" height="28" rx="3.58938" fill="#D2F525" />
      <path
        d="M14.771 14.5566C14.3617 14.9578 13.5534 15.2858 12.9746 15.2858H7.12158C6.54279 15.2858 6.40405 14.9578 6.81333 14.5566L13.2191 8.27801C13.6284 7.87686 14.4367 7.54858 15.0155 7.54858H20.8685C21.4473 7.54858 21.586 7.87686 21.1768 8.27801L14.771 14.5566Z"
        fill="#282828"
      />
      <path
        d="M14.7612 20.0894C14.352 20.4905 13.5436 20.8188 12.9648 20.8188H7.11182C6.53302 20.8188 6.39429 20.4905 6.80356 20.0894L13.2091 13.8108C13.6184 13.4096 14.4268 13.0815 15.0055 13.0815H20.8585C21.4373 13.0815 21.5761 13.4096 21.1668 13.8108L14.7612 20.0894Z"
        fill="#282828"
      />
      <path
        d="M43.6855 20.2563C42.6175 20.2563 41.6492 20.0783 40.7806 19.7223C39.9262 19.3521 39.2499 18.811 38.7515 18.099C38.2531 17.387 37.9825 16.5113 37.9398 15.4718H41.3573C41.3715 15.8848 41.4783 16.2479 41.6777 16.5611C41.8771 16.8744 42.1476 17.1236 42.4894 17.3087C42.8311 17.4796 43.2298 17.565 43.6855 17.565C44.0699 17.565 44.4046 17.5081 44.6894 17.3942C44.9884 17.266 45.2234 17.088 45.3942 16.8602C45.5651 16.6181 45.6505 16.3191 45.6505 15.9631C45.6505 15.5929 45.5509 15.2796 45.3515 15.0233C45.1522 14.7527 44.8816 14.5249 44.5399 14.3398C44.1981 14.1404 43.7994 13.9624 43.3437 13.8058C42.9023 13.6349 42.4253 13.4712 41.9127 13.3145C40.7308 12.9301 39.8194 12.4103 39.1787 11.7553C38.5521 11.1003 38.2388 10.2245 38.2388 9.12809C38.2388 8.21676 38.4596 7.4407 38.901 6.79992C39.3566 6.1449 39.9761 5.64651 40.7592 5.30476C41.5424 4.96301 42.4324 4.79214 43.4292 4.79214C44.4544 4.79214 45.3586 4.97013 46.1418 5.32612C46.925 5.66787 47.5444 6.17338 48.0001 6.84264C48.4557 7.49766 48.6978 8.28083 48.7263 9.19217H45.2874C45.2732 8.8789 45.1806 8.5941 45.0098 8.33779C44.8531 8.08148 44.6324 7.87501 44.3476 7.71837C44.0771 7.56173 43.7567 7.48342 43.3864 7.48342C43.0589 7.46918 42.7599 7.51902 42.4894 7.63293C42.233 7.73261 42.0194 7.89636 41.8486 8.1242C41.6919 8.33779 41.6136 8.60834 41.6136 8.93585C41.6136 9.24912 41.6919 9.5268 41.8486 9.76887C42.0194 9.9967 42.2473 10.1961 42.5321 10.3669C42.8311 10.5236 43.1729 10.6731 43.5573 10.8155C43.956 10.9579 44.3903 11.1003 44.8602 11.2427C45.6149 11.499 46.3056 11.8051 46.9321 12.1611C47.5729 12.5029 48.0855 12.9585 48.47 13.5281C48.8687 14.0835 49.068 14.8239 49.068 15.7495C49.068 16.5611 48.8544 17.3087 48.4273 17.9922C48.0143 18.6757 47.4091 19.2239 46.6117 19.6369C45.8285 20.0498 44.8531 20.2563 43.6855 20.2563ZM54.9702 20.2563C54.0731 20.2563 53.3113 20.0712 52.6848 19.701C52.0725 19.3307 51.6026 18.7896 51.2751 18.0777C50.9618 17.3514 50.8052 16.4686 50.8052 15.4291V9.23488H54.0091V15.1087C54.0091 15.9061 54.1728 16.5184 54.5003 16.9456C54.8278 17.3586 55.3547 17.565 56.0809 17.565C56.5223 17.565 56.9139 17.4654 57.2557 17.266C57.6117 17.0666 57.8822 16.7747 58.0673 16.3903C58.2667 16.0058 58.3664 15.5359 58.3664 14.9806V9.23488H61.5703V20H58.7722L58.5159 18.2913C58.2026 18.8751 57.7469 19.3521 57.1489 19.7223C56.5508 20.0783 55.8246 20.2563 54.9702 20.2563ZM63.811 24.6991V9.23488H66.6518L67.0149 10.6446C67.2427 10.3456 67.5062 10.0679 67.8052 9.81159C68.1042 9.55527 68.4602 9.35592 68.8732 9.21353C69.3004 9.05689 69.7987 8.97857 70.3683 8.97857C71.3651 8.97857 72.2408 9.22776 72.9955 9.72615C73.7645 10.2245 74.3768 10.9009 74.8324 11.7553C75.2881 12.5954 75.5159 13.5566 75.5159 14.6388C75.5159 15.721 75.281 16.6893 74.8111 17.5437C74.3554 18.3838 73.7431 19.0459 72.9742 19.5301C72.2052 20.0142 71.3437 20.2563 70.3897 20.2563C69.6207 20.2563 68.9586 20.121 68.4033 19.8505C67.8479 19.5799 67.3851 19.2026 67.0149 18.7184V24.6991H63.811ZM69.578 17.4582C70.0906 17.4582 70.5463 17.3443 70.945 17.1165C71.358 16.8744 71.6784 16.5398 71.9062 16.1126C72.134 15.6854 72.2479 15.1941 72.2479 14.6388C72.2479 14.0835 72.134 13.5922 71.9062 13.165C71.6784 12.7378 71.358 12.4032 70.945 12.1611C70.5463 11.9048 70.0906 11.7766 69.578 11.7766C69.0512 11.7766 68.5813 11.9048 68.1683 12.1611C67.7696 12.4032 67.4563 12.7378 67.2285 13.165C67.0007 13.5922 66.8867 14.0763 66.8867 14.6174C66.8867 15.1728 67.0007 15.6641 67.2285 16.0912C67.4563 16.5184 67.7696 16.8531 68.1683 17.0951C68.5813 17.3372 69.0512 17.4582 69.578 17.4582ZM82.7372 20.2563C81.6265 20.2563 80.6511 20.0285 79.811 19.5728C78.9709 19.1029 78.3087 18.455 77.8246 17.6291C77.3547 16.789 77.1197 15.8278 77.1197 14.7456C77.1197 13.6349 77.3547 12.6453 77.8246 11.7766C78.2945 10.908 78.9495 10.2245 79.7896 9.72615C80.6298 9.22776 81.6052 8.97857 82.7159 8.97857C83.7981 8.97857 84.745 9.21352 85.5567 9.68343C86.3683 10.1533 87.002 10.7941 87.4576 11.6058C87.9275 12.4032 88.1625 13.3288 88.1625 14.3825C88.1625 14.5249 88.1554 14.6886 88.1411 14.8738C88.1411 15.0446 88.1269 15.2226 88.0984 15.4077H79.4052V13.5495H84.8945C84.866 12.9514 84.6453 12.4744 84.2324 12.1184C83.8337 11.7482 83.3353 11.5631 82.7372 11.5631C82.2816 11.5631 81.8686 11.6699 81.4984 11.8834C81.1281 12.097 80.8291 12.4174 80.6013 12.8446C80.3877 13.2718 80.2809 13.8129 80.2809 14.4679V15.1087C80.2809 15.6071 80.3735 16.0485 80.5586 16.433C80.7579 16.8175 81.0356 17.1165 81.3916 17.3301C81.7618 17.5437 82.1961 17.6505 82.6945 17.6505C83.1644 17.6505 83.5489 17.5579 83.8479 17.3728C84.1612 17.1734 84.4033 16.9243 84.5741 16.6252H87.8421C87.6428 17.3087 87.301 17.9281 86.8169 18.4835C86.3327 19.0246 85.7418 19.4589 85.044 19.7864C84.3463 20.0997 83.5774 20.2563 82.7372 20.2563ZM89.9846 20V9.23488H92.8253L93.1244 11.1999C93.4092 10.7443 93.7438 10.3527 94.1283 10.0252C94.5127 9.69767 94.9542 9.44136 95.4525 9.25624C95.9652 9.07113 96.5134 8.97857 97.0972 8.97857V12.3747H96.0293C95.6021 12.3747 95.2105 12.4245 94.8545 12.5242C94.5127 12.6097 94.2137 12.7592 93.9574 12.9728C93.7153 13.1864 93.5231 13.4783 93.3807 13.8485C93.2525 14.2045 93.1885 14.653 93.1885 15.1941V20H89.9846ZM98.4625 20V5.04845H108.48V7.63293H101.666V11.1572H107.839V13.6349H101.666V17.4155H108.48V20H98.4625ZM110.443 20V4.62126H113.647V20H110.443ZM121.192 20.2563C120.082 20.2563 119.106 20.0285 118.266 19.5728C117.426 19.1029 116.764 18.455 116.28 17.6291C115.81 16.789 115.575 15.8278 115.575 14.7456C115.575 13.6349 115.81 12.6453 116.28 11.7766C116.75 10.908 117.405 10.2245 118.245 9.72615C119.085 9.22776 120.06 8.97857 121.171 8.97857C122.253 8.97857 123.2 9.21352 124.012 9.68343C124.823 10.1533 125.457 10.7941 125.913 11.6058C126.383 12.4032 126.618 13.3288 126.618 14.3825C126.618 14.5249 126.611 14.6886 126.596 14.8738C126.596 15.0446 126.582 15.2226 126.554 15.4077H117.86V13.5495H123.35C123.321 12.9514 123.101 12.4744 122.688 12.1184C122.289 11.7482 121.79 11.5631 121.192 11.5631C120.737 11.5631 120.324 11.6699 119.954 11.8834C119.583 12.097 119.284 12.4174 119.056 12.8446C118.843 13.2718 118.736 13.8129 118.736 14.4679V15.1087C118.736 15.6071 118.829 16.0485 119.014 16.433C119.213 16.8175 119.491 17.1165 119.847 17.3301C120.217 17.5437 120.651 17.6505 121.15 17.6505C121.62 17.6505 122.004 17.5579 122.303 17.3728C122.616 17.1734 122.858 16.9243 123.029 16.6252H126.297C126.098 17.3087 125.756 17.9281 125.272 18.4835C124.788 19.0246 124.197 19.4589 123.499 19.7864C122.801 20.0997 122.033 20.2563 121.192 20.2563ZM128.44 20V9.23488H131.238L131.515 10.6232C131.857 10.1249 132.306 9.72615 132.861 9.42712C133.431 9.12809 134.086 8.97857 134.826 8.97857C135.353 8.97857 135.83 9.04977 136.257 9.19217C136.684 9.32032 137.062 9.51968 137.389 9.79023C137.717 10.0465 137.987 10.3741 138.201 10.7728C138.614 10.2174 139.141 9.78311 139.782 9.46984C140.422 9.14233 141.12 8.97857 141.875 8.97857C142.843 8.97857 143.64 9.17081 144.267 9.55527C144.908 9.93974 145.385 10.4951 145.698 11.2213C146.011 11.9475 146.168 12.8304 146.168 13.8699V20H142.985V14.1475C142.985 13.3644 142.829 12.7592 142.516 12.332C142.217 11.8906 141.732 11.6699 141.063 11.6699C140.636 11.6699 140.259 11.7766 139.931 11.9902C139.604 12.2038 139.347 12.5029 139.162 12.8873C138.991 13.2718 138.906 13.7346 138.906 14.2757V20H135.723V14.1475C135.723 13.3644 135.567 12.7592 135.253 12.332C134.94 11.8906 134.435 11.6699 133.737 11.6699C133.338 11.6699 132.975 11.7766 132.648 11.9902C132.334 12.2038 132.085 12.5029 131.9 12.8873C131.729 13.2718 131.644 13.7346 131.644 14.2757V20H128.44ZM153.603 20.2563C152.492 20.2563 151.517 20.0285 150.676 19.5728C149.836 19.1029 149.174 18.455 148.69 17.6291C148.22 16.789 147.985 15.8278 147.985 14.7456C147.985 13.6349 148.22 12.6453 148.69 11.7766C149.16 10.908 149.815 10.2245 150.655 9.72615C151.495 9.22776 152.471 8.97857 153.581 8.97857C154.664 8.97857 155.611 9.21352 156.422 9.68343C157.234 10.1533 157.867 10.7941 158.323 11.6058C158.793 12.4032 159.028 13.3288 159.028 14.3825C159.028 14.5249 159.021 14.6886 159.007 14.8738C159.007 15.0446 158.992 15.2226 158.964 15.4077H150.271V13.5495H155.76C155.732 12.9514 155.511 12.4744 155.098 12.1184C154.699 11.7482 154.201 11.5631 153.603 11.5631C153.147 11.5631 152.734 11.6699 152.364 11.8834C151.994 12.097 151.695 12.4174 151.467 12.8446C151.253 13.2718 151.146 13.8129 151.146 14.4679V15.1087C151.146 15.6071 151.239 16.0485 151.424 16.433C151.623 16.8175 151.901 17.1165 152.257 17.3301C152.627 17.5437 153.062 17.6505 153.56 17.6505C154.03 17.6505 154.414 17.5579 154.713 17.3728C155.027 17.1734 155.269 16.9243 155.44 16.6252H158.708C158.508 17.3087 158.167 17.9281 157.682 18.4835C157.198 19.0246 156.607 19.4589 155.91 19.7864C155.212 20.0997 154.443 20.2563 153.603 20.2563ZM160.85 20V9.23488H163.648L163.904 10.965C164.232 10.3669 164.695 9.8899 165.293 9.53392C165.891 9.16369 166.617 8.97857 167.471 8.97857C168.369 8.97857 169.123 9.17081 169.736 9.55527C170.348 9.93974 170.811 10.4951 171.124 11.2213C171.451 11.9333 171.615 12.809 171.615 13.8485V20H168.433V14.1475C168.433 13.3644 168.262 12.7592 167.92 12.332C167.592 11.8906 167.066 11.6699 166.339 11.6699C165.912 11.6699 165.521 11.7766 165.165 11.9902C164.823 12.1896 164.552 12.4815 164.353 12.866C164.154 13.2504 164.054 13.7132 164.054 14.2543V20H160.85ZM178.79 20C178.007 20 177.316 19.879 176.718 19.6369C176.12 19.3806 175.657 18.9676 175.33 18.398C175.002 17.8285 174.838 17.0524 174.838 16.0699V11.9048H173.002V9.23488H174.838L175.18 6.20186H178.042V9.23488H180.798V11.9048H178.042V16.1126C178.042 16.5398 178.135 16.8459 178.32 17.031C178.519 17.2019 178.854 17.2874 179.324 17.2874H180.798V20H178.79ZM187.212 20.2563C186.201 20.2563 185.325 20.0997 184.585 19.7864C183.859 19.4589 183.282 19.0175 182.855 18.4621C182.442 17.9068 182.207 17.2802 182.15 16.5825H185.333C185.39 16.8246 185.489 17.0453 185.632 17.2446C185.788 17.4298 185.995 17.5793 186.251 17.6932C186.522 17.7929 186.821 17.8427 187.148 17.8427C187.504 17.8427 187.789 17.8 188.002 17.7145C188.23 17.6149 188.401 17.4867 188.515 17.3301C188.629 17.1734 188.686 17.0097 188.686 16.8388C188.686 16.5683 188.601 16.3618 188.43 16.2194C188.273 16.077 188.038 15.9631 187.725 15.8776C187.412 15.778 187.034 15.6854 186.593 15.6C186.08 15.4861 185.568 15.3579 185.055 15.2155C184.556 15.0589 184.108 14.8666 183.709 14.6388C183.325 14.411 183.011 14.1191 182.769 13.7631C182.542 13.3928 182.428 12.9443 182.428 12.4174C182.428 11.7766 182.606 11.1999 182.962 10.6873C183.318 10.1605 183.83 9.74751 184.5 9.44848C185.169 9.13521 185.98 8.97857 186.935 8.97857C188.287 8.97857 189.348 9.2776 190.117 9.87566C190.886 10.4737 191.342 11.2783 191.484 12.2893H188.494C188.408 12.0045 188.23 11.7909 187.96 11.6485C187.689 11.4919 187.347 11.4135 186.935 11.4135C186.465 11.4135 186.109 11.4919 185.867 11.6485C185.624 11.8051 185.503 12.0116 185.503 12.2679C185.503 12.4388 185.582 12.5954 185.738 12.7378C185.909 12.866 186.151 12.9799 186.465 13.0796C186.778 13.1792 187.162 13.2789 187.618 13.3786C188.487 13.5637 189.234 13.7631 189.861 13.9767C190.502 14.1903 191 14.5035 191.356 14.9165C191.712 15.3152 191.883 15.899 191.869 16.6679C191.883 17.3657 191.698 17.9851 191.313 18.5262C190.943 19.0673 190.409 19.4945 189.711 19.8078C189.013 20.1068 188.18 20.2563 187.212 20.2563ZM195.223 20.1068C194.639 20.1068 194.162 19.9359 193.792 19.5942C193.436 19.2382 193.258 18.811 193.258 18.3126C193.258 17.8 193.436 17.3728 193.792 17.031C194.162 16.6751 194.639 16.4971 195.223 16.4971C195.792 16.4971 196.255 16.6751 196.611 17.031C196.967 17.3728 197.145 17.8 197.145 18.3126C197.145 18.811 196.967 19.2382 196.611 19.5942C196.255 19.9359 195.792 20.1068 195.223 20.1068ZM198.952 20V9.23488H202.156V20H198.952ZM200.554 7.99604C199.984 7.99604 199.521 7.83229 199.165 7.50478C198.809 7.17727 198.631 6.76432 198.631 6.26593C198.631 5.75331 198.809 5.33324 199.165 5.00573C199.521 4.67822 199.984 4.51447 200.554 4.51447C201.137 4.51447 201.607 4.67822 201.963 5.00573C202.334 5.33324 202.519 5.75331 202.519 6.26593C202.519 6.76432 202.334 7.17727 201.963 7.50478C201.607 7.83229 201.137 7.99604 200.554 7.99604ZM209.614 20.2563C208.574 20.2563 207.642 20.0142 206.816 19.5301C205.99 19.0459 205.335 18.3838 204.851 17.5437C204.367 16.6893 204.124 15.721 204.124 14.6388C204.124 13.5281 204.367 12.5527 204.851 11.7126C205.335 10.8582 205.99 10.1889 206.816 9.70479C207.656 9.22064 208.589 8.97857 209.614 8.97857C210.668 8.97857 211.607 9.22064 212.433 9.70479C213.259 10.1889 213.914 10.8582 214.398 11.7126C214.882 12.5527 215.125 13.521 215.125 14.6174C215.125 15.7139 214.882 16.6893 214.398 17.5437C213.914 18.3838 213.259 19.0459 212.433 19.5301C211.607 20.0142 210.668 20.2563 209.614 20.2563ZM209.614 17.4796C210.041 17.4796 210.418 17.3728 210.746 17.1592C211.088 16.9456 211.358 16.6252 211.557 16.198C211.757 15.7708 211.857 15.244 211.857 14.6174C211.857 13.9909 211.757 13.464 211.557 13.0368C211.358 12.6097 211.095 12.2893 210.767 12.0757C210.44 11.8621 210.062 11.7553 209.635 11.7553C209.208 11.7553 208.823 11.8621 208.482 12.0757C208.154 12.2893 207.891 12.6097 207.691 13.0368C207.492 13.464 207.392 13.9909 207.392 14.6174C207.392 15.244 207.492 15.7708 207.691 16.198C207.891 16.6252 208.154 16.9456 208.482 17.1592C208.823 17.3728 209.201 17.4796 209.614 17.4796Z"
        fill="white"
      />
    </svg>
  );
}

// ─── Shared variants ───────────────────────────────────────────────────────────

const vFadeUp = {
  hidden:  { opacity: 0, y: 20, filter: "blur(6px)" },
  visible: { opacity: 1, y: 0,  filter: "blur(0px)", transition: { duration: 0.6, ease: E1 } },
};
const vStagger = (delay = 0, gap = 0.1) => ({
  hidden:  {},
  visible: { transition: { staggerChildren: gap, delayChildren: delay } },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Reveal({
  children, className, style, delay = 0, gap = 0.1,
}: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties; delay?: number; gap?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div ref={ref} initial="hidden" animate={inView ? "visible" : "hidden"}
      variants={vStagger(delay, gap)} className={className} style={style}>
      {children}
    </motion.div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 16,
      maxWidth: 1100, margin: "0 auto", padding: "0 48px",
    }}>
      <div style={{ flex: 1, height: 1, background: BORDER }} />
      <span style={{
        fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600,
        letterSpacing: "0.16em", textTransform: "uppercase", color: TEXT_3,
        whiteSpace: "nowrap",
      }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: BORDER }} />
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={vFadeUp}>
      <span style={{
        fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600,
        letterSpacing: "0.12em", textTransform: "uppercase", color: GREEN,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ width: 20, height: 1.5, background: GREEN, display: "inline-block", flexShrink: 0 }} />
        {children}
      </span>
    </motion.div>
  );
}

function MagBtn({
  children, href, primary = false,
}: {
  children: React.ReactNode; href: string; primary?: boolean;
}) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 220, damping: 18 });
  const sy = useSpring(my, { stiffness: 220, damping: 18 });
  const onMove = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    mx.set((e.clientX - r.left - r.width / 2) * 0.28);
    my.set((e.clientY - r.top - r.height / 2) * 0.28);
  }, [mx, my]);
  const onLeave = useCallback(() => { mx.set(0); my.set(0); }, [mx, my]);

  return (
    <motion.a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      style={{
        x: sx, y: sy,
        display: "inline-flex", alignItems: "center", gap: 7,
        padding: primary ? "12px 24px" : "0",
        borderRadius: primary ? 6 : 0,
        fontSize: 14, fontWeight: 600, textDecoration: "none",
        cursor: "pointer", fontFamily: "Inter, sans-serif",
        ...(primary
          ? { background: GREEN, color: "#111" }
          : { borderBottom: `1px solid ${TEXT_3}`, color: TEXT_2, paddingBottom: 2 }),
      }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      whileHover={primary
        ? { scale: 1.03, backgroundColor: GREEN_DIM }
        : { color: TEXT_1, borderBottomColor: TEXT_1 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
    >
      {children}
    </motion.a>
  );
}

// ─── NAV ──────────────────────────────────────────────────────────────────────

function Nav() {
  const { scrollY } = useScroll();
  const bg   = useTransform(scrollY, [0, 80], [`rgba(15,15,15,0)`, `rgba(15,15,15,0.92)`]);
  const blur = useTransform(scrollY, [0, 80], ["blur(0px)", "blur(14px)"]);
  const bdr  = useTransform(scrollY, [0, 80], ["rgba(255,255,255,0)", BORDER]);

  return (
    <motion.header style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      backgroundColor: bg, backdropFilter: blur,
      borderBottom: "1px solid", borderBottomColor: bdr,
    }}>
      <div style={{
        maxWidth: 1100, margin: "0 auto", padding: "0 48px", height: 60,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Logo real */}
        <motion.div
          initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: E1 }}
        >
          <LogoSVG size={22} />
        </motion.div>

        {/* Badge + CTA */}
        <motion.div
          initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: E1 }}
          style={{ display: "flex", alignItems: "center", gap: 12 }}
        >
          <span className="spo-hide-mobile" style={{
            padding: "4px 12px", borderRadius: 5,
            border: `1px solid ${BORDER2}`, background: BG3,
            fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600,
            letterSpacing: "0.10em", textTransform: "uppercase", color: TEXT_3,
          }}>Exclusivo para Ousen</span>
          <motion.a
            href="#contato"
            whileHover={{ backgroundColor: GREEN_DIM }}
            whileTap={{ scale: 0.96 }}
            style={{
              padding: "8px 18px", borderRadius: 6, background: GREEN,
              color: "#111", fontFamily: "Inter, sans-serif",
              fontSize: 13, fontWeight: 600, textDecoration: "none",
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
  const stats = [
    { value: "3 dias",  desc: "prazo médio de entrega por página" },
    { value: "R$600",   desc: "custo fixo por página criada" },
    { value: "60%",     desc: "de margem líquida no modelo padrão" },
    { value: "2.900+",  desc: "componentes Elementor da biblioteca" },
  ];

  return (
    <section style={{ padding: "140px 48px 100px", maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 64, alignItems: "center" }} className="spo-hero-grid">

        {/* Left */}
        <motion.div initial="hidden" animate="visible" variants={vStagger(0.08, 0.1)}>
          <Eyebrow>Studio Partners · Proposta para Ousen</Eyebrow>

          <motion.h1
            variants={vFadeUp}
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "clamp(36px, 5vw, 58px)",
              fontWeight: 700, lineHeight: 1.08,
              letterSpacing: "-0.03em", color: TEXT_1,
              margin: "20px 0 20px",
            }}
          >
            A Ousen vende.<br />
            A gente <span style={{ color: GREEN }}>entrega.</span>
          </motion.h1>

          <motion.p
            variants={vFadeUp}
            style={{
              fontFamily: "Inter, sans-serif", fontSize: 17, color: TEXT_2,
              maxWidth: 520, lineHeight: 1.7, marginBottom: 36,
            }}
          >
            Produção de páginas Elementor em até 3 dias, com processo definido, painel centralizado e acompanhamento ativo — invisível para o seu cliente.
          </motion.p>

          <motion.div variants={vFadeUp} style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
            <MagBtn href="#contato" primary>Quero ser parceiro</MagBtn>
            <MagBtn href="#solucao">Entender a proposta →</MagBtn>
          </motion.div>
        </motion.div>

        {/* Right — aside card */}
        <motion.div
          className="spo-hero-aside"
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.7, ease: E1 }}
          style={{
            background: BG2, border: `1px solid ${BORDER2}`,
            borderRadius: 10, padding: "24px",
          }}
        >
          <div style={{
            fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
            letterSpacing: "0.12em", textTransform: "uppercase", color: TEXT_3,
            marginBottom: 20, paddingBottom: 14, borderBottom: `1px solid ${BORDER}`,
          }}>Em números</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {stats.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.55 + i * 0.08, duration: 0.5, ease: E1 }}
                style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}
              >
                <span style={{
                  fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 26,
                  color: GREEN, lineHeight: 1, letterSpacing: "-0.03em",
                }}>{s.value}</span>
                <span style={{
                  fontFamily: "Inter, sans-serif", fontSize: 12,
                  color: TEXT_3, textAlign: "right", maxWidth: 120, lineHeight: 1.45,
                }}>{s.desc}</span>
              </motion.div>
            ))}
          </div>
          <div style={{
            marginTop: 20, paddingTop: 14, borderTop: `1px solid ${BORDER}`,
            fontFamily: "Inter, sans-serif", fontSize: 10.5, color: TEXT_3,
          }}>
            Proposta preparada exclusivamente para a equipe Ousen.
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── PROBLEMA ─────────────────────────────────────────────────────────────────

const pains = [
  { icon: "💸", title: "Os bons cobram caro e demoram",        desc: "Webdesigners de qualidade têm agenda cheia. Quando precisar de urgência, não estão disponíveis — e o funil fica parado." },
  { icon: "⏳", title: "Os baratos entregam sem processo",    desc: "Sem briefing estruturado, sem revisão, sem padrão. O resultado é retrabalho e prazo estourado toda vez." },
  { icon: "📊", title: "Gestão por planilha e WhatsApp",     desc: "Links salvos em tabelas, histórico perdido em grupos, ninguém sabe o status real de cada projeto sem perguntar." },
  { icon: "🔗", title: "Zero visibilidade dos projetos ativos", desc: "Múltiplos clientes, múltiplas páginas, múltiplas URLs — tudo espalhado. Sem visão centralizada de nada." },
];

function ProblemSection() {
  return (
    <section style={{ padding: "80px 0" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 48px" }}>
        <Reveal style={{ marginBottom: 48 }}>
          <Eyebrow>O gargalo que trava a operação</Eyebrow>
          <motion.h2
            variants={vFadeUp}
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 700,
              lineHeight: 1.08, letterSpacing: "-0.03em", color: TEXT_1,
              margin: "16px 0 18px",
            }}
          >
            A venda está resolvida.<br />
            <span style={{ color: GREEN }}>A entrega não.</span>
          </motion.h2>
          <motion.p
            variants={vFadeUp}
            style={{
              fontFamily: "Inter, sans-serif", fontSize: 17, color: TEXT_2,
              maxWidth: 600, lineHeight: 1.7,
            }}
          >
            Toda vez que a Ousen fecha um contrato, começa o mesmo ciclo — e o tempo perdido gerenciando produção é tempo que devia estar em vendas.
          </motion.p>
        </Reveal>

        {/* Grid 2×2 */}
        <motion.div
          initial="hidden" whileInView="visible"
          viewport={{ once: true, amount: 0.1 }}
          variants={vStagger(0, 0.08)}
          style={{
            display: "grid", gridTemplateColumns: "1fr 1fr",
            gap: 1, background: BORDER,
            border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden",
            marginBottom: 48,
          }}
          className="spo-pain-grid"
        >
          {pains.map((p, i) => (
            <motion.div
              key={i}
              variants={vFadeUp}
              whileHover={{ backgroundColor: BG3 }}
              style={{
                background: BG2, padding: "28px 24px",
                display: "flex", gap: 16, alignItems: "flex-start",
                transition: "background 0.2s",
              }}
            >
              <span style={{ fontSize: 20, flexShrink: 0, marginTop: 2 }}>{p.icon}</span>
              <div>
                <div style={{
                  fontFamily: "Inter, sans-serif", fontWeight: 600,
                  fontSize: 14, color: TEXT_1, marginBottom: 7, lineHeight: 1.35,
                }}>{p.title}</div>
                <div style={{
                  fontFamily: "Inter, sans-serif", fontSize: 13.5,
                  color: TEXT_2, lineHeight: 1.65,
                }}>{p.desc}</div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Pull quote */}
        <Reveal>
          <motion.blockquote
            variants={vFadeUp}
            style={{
              borderLeft: `3px solid ${GREEN}`,
              background: BG2, border: `1px solid ${BORDER2}`,
              borderLeftColor: GREEN,
              padding: "32px 36px", borderRadius: "0 10px 10px 0",
              margin: 0,
            }}
          >
            <p style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "clamp(16px, 2.2vw, 22px)",
              color: TEXT_2, lineHeight: 1.6, margin: "0 0 16px",
            }}>
              A operação que deveria escalar começa a travar 
            </p>
            <cite style={{
              fontFamily: "Inter, sans-serif", fontSize: 11,
              fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase",
              color: GREEN, fontStyle: "normal",
            }}>O cenário que a SuperElements resolve</cite>
          </motion.blockquote>
        </Reveal>
      </div>
    </section>
  );
}

// ─── SOLUÇÃO ──────────────────────────────────────────────────────────────────

const steps = [
  { num: "01", title: "Briefing estruturado",  desc: "Formulário direto. Sem reunião longa, sem e-mail perdido." },
  { num: "02", title: "Produção no Elementor", desc: "2.900+ componentes. Rápido e com padrão garantido." },
  { num: "03", title: "Revisão e ajuste",      desc: "Uma rodada clara, escopo definido. Sem voltar à estaca zero." },
  { num: "04", title: "Entrega em até 3 dias", desc: "Publicada, testada, conectada ao painel. A Ousen apresenta." },
  { num: "05", title: "Acompanhamento ativo",  desc: "Monitoramos diariamente. Bugs e ajustes sem a Ousen cobrar." },
];

function SolutionSection() {
  return (
    <section id="solucao" style={{ padding: "80px 0 56px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 48px" }}>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 64, marginBottom: 72 }} className="spo-sol-grid">

          {/* Left */}
          <Reveal>
            <Eyebrow>Como a SuperElements entra na operação</Eyebrow>
            <motion.h2
              variants={vFadeUp}
              style={{
                fontFamily: "Inter, sans-serif",
                fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 700,
                lineHeight: 1.08, letterSpacing: "-0.03em", color: TEXT_1,
                margin: "16px 0 24px",
              }}
            >
              Processo, ferramenta<br />
              e <span style={{ color: GREEN }}>entrega real.</span>
            </motion.h2>

            {[
              "A SuperElements é um estúdio de produção de páginas especializado em Wordpress e Elementor.",
              "O que nos permite entregar em 3 dias não é sorte — é processo.",
              "Desenvolvemos um fluxo de produção otimizado de ponta a ponta: do briefing estruturado à entrega final, cada etapa tem responsável, prazo e padrão de qualidade definido. Sem achismo, sem retrabalho, sem projeto parado.",
              "Por trás disso, existe uma ferramenta própria — o painel SuperElements. É onde a Ousen acompanha todos os projetos em tempo real, num único lugar. Cada cliente, cada página, cada status. Sem planilha, sem ficar procurando em grupos de WhatsApp.",
            ].map((p, i) => (
              <motion.p key={i} variants={vFadeUp} style={{
                fontFamily: "Inter, sans-serif", fontSize: 15.5, color: TEXT_2,
                lineHeight: 1.75, marginBottom: 16,
              }}>{p}</motion.p>
            ))}

            <motion.div
              variants={vFadeUp}
              style={{
                borderLeft: `3px solid ${GREEN}`,
                background: GREEN_BG, border: `1px solid ${BORDER2}`,
                borderLeftColor: GREEN,
                padding: "20px 22px", borderRadius: "0 8px 8px 0", marginTop: 8,
              }}
            >
              <div style={{
                fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 600,
                letterSpacing: "0.12em", textTransform: "uppercase", color: GREEN,
                marginBottom: 9,
              }}>Como funciona na prática</div>
              <p style={{
                fontFamily: "Inter, sans-serif", fontSize: 14, color: TEXT_2,
                lineHeight: 1.7, margin: 0,
              }}>
                A Ousen fecha o contrato com o escritório. Passa o briefing pra nós. Aprovamos todas etapas em entregáveis rápidos. Em até 3 dias úteis a página está no ar — construída no Elementor, testada, responsiva, com a marca da Ousen. 
              </p>
            </motion.div>
          </Reveal>

          {/* Right — process card (sticky) */}
          <Reveal>
            <motion.div
              variants={vFadeUp}
              className="spo-process-sticky"
              style={{
                position: "sticky", top: 80,
                background: BG2, border: `1px solid ${BORDER2}`,
                borderRadius: 10, overflow: "hidden",
              }}
            >
              <div style={{
                padding: "16px 20px", borderBottom: `1px solid ${BORDER}`,
                fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
                letterSpacing: "0.12em", textTransform: "uppercase", color: TEXT_3,
              }}>Do briefing ao ar</div>

              <div style={{ padding: "6px 0" }}>
                {steps.map((s, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 14, alignItems: "flex-start",
                    padding: "13px 20px",
                    borderBottom: i < steps.length - 1 ? `1px solid ${BORDER}` : "none",
                  }}>
                    <span style={{
                      fontFamily: "Inter, sans-serif", fontSize: 11,
                      fontWeight: 700, color: GREEN, minWidth: 22, lineHeight: 1.4,
                      letterSpacing: "0.04em",
                    }}>{s.num}</span>
                    <div>
                      <div style={{
                        fontFamily: "Inter, sans-serif", fontWeight: 600,
                        fontSize: 13, color: TEXT_1, marginBottom: 3,
                      }}>{s.title}</div>
                      <div style={{
                        fontFamily: "Inter, sans-serif", fontSize: 12,
                        color: TEXT_2, lineHeight: 1.55,
                      }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                background: GREEN, padding: "14px 20px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{
                  fontFamily: "Inter, sans-serif", fontSize: 16, fontWeight: 700,
                  color: "#111",
                }}>3 dias úteis</span>
                <span style={{
                  fontFamily: "Inter, sans-serif", fontSize: 11,
                  color: "rgba(0,0,0,0.55)",
                }}>do briefing à página no ar</span>
              </div>
            </motion.div>
          </Reveal>
        </div>

        {/* Dashboard */}
        <Dashboard />
      </div>
    </section>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────

type NavId = "inicio" | "clientes" | "paginas" | "propostas" | "recursos" | "componentes";

const navItems: { id: NavId; icon: string; label: string }[] = [
  { id: "inicio",      icon: "🏠", label: "Início" },
  { id: "clientes",    icon: "👥", label: "Clientes" },
  { id: "paginas",     icon: "📄", label: "Páginas" },
  { id: "propostas",   icon: "📋", label: "Propostas" },
  { id: "recursos",    icon: "📦", label: "Recursos" },
  { id: "componentes", icon: "🧩", label: "Componentes" },
];

function Dashboard() {
  const [active, setActive] = useState<NavId>("inicio");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, ease: E1 }}
      style={{
        borderRadius: 12, border: `1px solid ${BORDER2}`, overflow: "hidden",
        boxShadow: `0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px ${BORDER}`,
      }}
    >
      {/* Chrome bar */}
      <div style={{
        background: BG3, padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 12,
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: "flex", gap: 6 }}>
          {["#ff5f57","#ffbd2e","#28c840"].map(c => (
            <div key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c }} />
          ))}
        </div>
        <div style={{
          flex: 1, background: "rgba(255,255,255,0.05)", borderRadius: 5,
          padding: "4px 13px", fontSize: 11, color: TEXT_3,
          fontFamily: "monospace",
        }}>
          app.superelements.io/dashboard
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["Compartilhar","•••"].map(l => (
            <div key={l} style={{
              padding: "3px 8px", borderRadius: 5,
              background: "rgba(255,255,255,0.04)",
              color: TEXT_3, fontSize: 10,
            }}>{l}</div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", height: 500 }}>
        {/* Sidebar */}
        <div className="spo-dash-sidebar" style={{
          width: 200, background: BG2,
          borderRight: `1px solid ${BORDER}`,
          display: "flex", flexDirection: "column", padding: "12px 0", flexShrink: 0,
        }}>
          {/* Logo no sidebar */}
          <div style={{
            padding: "0 12px 12px",
            borderBottom: `1px solid ${BORDER}`, marginBottom: 6,
          }}>
            <LogoSVG size={18} />
          </div>

          <nav style={{ flex: 1, padding: "0 6px" }}>
            {navItems.map(item => (
              <motion.button
                key={item.id}
                onClick={() => setActive(item.id)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 8,
                  padding: "7px 9px", borderRadius: 6, border: "none",
                  background: "transparent",
                  color: active === item.id ? TEXT_1 : TEXT_3,
                  fontSize: 12.5,
                  fontWeight: active === item.id ? 600 : 400,
                  fontFamily: "Inter, sans-serif",
                  cursor: "pointer", textAlign: "left", marginBottom: 1, position: "relative",
                }}
                whileHover={{ backgroundColor: active === item.id ? undefined : "rgba(255,255,255,0.04)" }}
              >
                {active === item.id && (
                  <motion.span
                    layoutId="spo-nav-pill"
                    style={{
                      position: "absolute", inset: 0, borderRadius: 6,
                      background: `${GREEN}18`, border: `1px solid ${GREEN}44`,
                    }}
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                  />
                )}
                <span style={{ fontSize: 13, position: "relative", zIndex: 1 }}>{item.icon}</span>
                <span style={{ position: "relative", zIndex: 1 }}>{item.label}</span>
              </motion.button>
            ))}
          </nav>

          <div style={{
            margin: "0 6px", padding: "9px 11px", borderRadius: 7,
            border: `1px solid ${BORDER}`,
            background: "rgba(255,255,255,0.02)",
          }}>
            <div style={{
              fontSize: 9, fontWeight: 600, letterSpacing: "0.1em",
              color: TEXT_3, textTransform: "uppercase",
              marginBottom: 4, fontFamily: "Inter, sans-serif",
            }}>WORKSPACE</div>
            <div style={{ color: TEXT_1, fontSize: 12, fontWeight: 600, marginBottom: 4, fontFamily: "Inter, sans-serif" }}>Ousen</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <motion.div
                style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN }}
                animate={{ opacity: [1, 0.35, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span style={{ color: GREEN, fontSize: 10, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>Ativo</span>
            </div>
          </div>
        </div>

        {/* Main panel */}
        <div style={{ flex: 1, overflow: "auto", padding: "18px 20px", background: BG }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: E2 }}
            >
              {active === "inicio"      && <DScreenInicio />}
              {active === "clientes"    && <DScreenClientes />}
              {active === "paginas"     && <DScreenPaginas />}
              {active === "propostas"   && <DScreenPropostas />}
              {active === "recursos"    && <DScreenRecursos />}
              {active === "componentes" && <DScreenComponentes />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Dashboard Screens ─────────────────────────────────────────────────────────

const DS = {
  primary: TEXT_1,
  sub: TEXT_2,
  muted: TEXT_3,
  accent: GREEN,
  border: BORDER,
  card: BG2,
};

function DScreenInicio() {
  const kpis = [
    { label: "Clientes ativos", value: "8",  hi: false },
    { label: "Conectados",      value: "8",  hi: true  },
    { label: "Páginas live",    value: "24", hi: false },
    { label: "Em produção",     value: "3",  hi: false },
  ];
  const rows = [
    { name: "dr-joao-advogados.com.br",  pages: "5 págs.", upd: "Hoje"  },
    { name: "escritorio-silva.com.br",   pages: "3 págs.", upd: "Hoje"  },
    { name: "advocacia-torres.com",      pages: "8 págs.", upd: "Ontem" },
  ];
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ color: DS.primary, fontWeight: 700, fontSize: 15, marginBottom: 2, fontFamily: "Inter, sans-serif" }}>Boa tarde, Ousen 👋</div>
        <div style={{ color: DS.muted, fontSize: 11, fontFamily: "Inter, sans-serif" }}>Visão geral dos seus projetos ativos no nicho jurídico</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 16 }}>
        {kpis.map(k => (
          <div key={k.label} style={{
            borderRadius: 8,
            border: k.hi ? `1px solid ${GREEN}55` : `1px solid ${DS.border}`,
            background: k.hi ? `${GREEN}15` : DS.card,
            padding: "11px 12px",
          }}>
            <div style={{ color: k.hi ? GREEN : DS.primary, fontWeight: 800, fontSize: 22, marginBottom: 2, fontFamily: "Inter, sans-serif" }}>{k.value}</div>
            <div style={{ color: DS.muted, fontSize: 10, fontFamily: "Inter, sans-serif" }}>{k.label}</div>
          </div>
        ))}
      </div>
      <div style={{ borderRadius: 8, border: `1px solid ${DS.border}`, background: DS.card, padding: "12px 14px" }}>
        <div style={{ color: DS.primary, fontWeight: 600, fontSize: 12, marginBottom: 3, fontFamily: "Inter, sans-serif" }}>Carteira de Clientes</div>
        <div style={{ color: DS.muted, fontSize: 10, marginBottom: 11, fontFamily: "Inter, sans-serif" }}>Todas as contas operando normalmente</div>
        {rows.map((r, i) => (
          <div key={r.name} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "7px 0",
            borderBottom: i < rows.length - 1 ? `1px solid ${DS.border}` : "none",
          }}>
            <span style={{ color: DS.sub, fontSize: 11, fontFamily: "Inter, sans-serif" }}>{r.name}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ color: DS.muted, fontSize: 10, fontFamily: "Inter, sans-serif" }}>{r.pages}</span>
              <span style={{ color: DS.muted, fontSize: 10, fontFamily: "Inter, sans-serif" }}>{r.upd}</span>
              <span style={{ color: GREEN, fontSize: 10, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>● Conectado</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DScreenClientes() {
  const cl = [
    { name: "Dr. João Advogados",       domain: "dr-joao-advogados.com.br", niche: "Dir. Trabalhista", pages: 5, score: "98/100" },
    { name: "Escritório Silva & Assoc.", domain: "escritorio-silva.com.br",  niche: "Dir. Civil",       pages: 3, score: "94/100" },
    { name: "Advocacia Torres",          domain: "advocacia-torres.com",     niche: "Dir. Criminal",    pages: 8, score: "91/100" },
    { name: "Dra. Camila Mendes",        domain: "camilamendes-adv.com.br",  niche: "Dir. Família",     pages: 2, score: "96/100" },
  ];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ color: DS.primary, fontWeight: 700, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Carteira de Clientes</div>
          <div style={{ color: DS.muted, fontSize: 10, marginTop: 2, fontFamily: "Inter, sans-serif" }}>8 clientes · todos conectados</div>
        </div>
        <button style={{ padding: "5px 10px", borderRadius: 5, border: `1px solid ${GREEN}55`, background: `${GREEN}15`, color: GREEN, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>+ Novo</button>
      </div>
      {cl.map(c => (
        <div key={c.name} style={{ borderRadius: 8, border: `1px solid ${DS.border}`, background: DS.card, padding: "10px 13px", marginBottom: 6, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: DS.primary, fontWeight: 600, fontSize: 12, fontFamily: "Inter, sans-serif" }}>{c.name}</div>
            <div style={{ color: DS.muted, fontSize: 10, marginTop: 2, fontFamily: "Inter, sans-serif" }}>{c.domain} · {c.niche}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: DS.muted, fontSize: 10, fontFamily: "Inter, sans-serif" }}>{c.pages} págs.</span>
            <span style={{ color: GREEN, fontSize: 11, fontWeight: 700, fontFamily: "Inter, sans-serif" }}>{c.score}</span>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DScreenPaginas() {
  const rows = [
    { name: "Home",                       url: "advocacia-torres.com/",  speed: "97", sc: "#4ade80", status: "Live" },
    { name: "Landing — Dir. Criminal",    url: "/direito-criminal",      speed: "91", sc: "#4ade80", status: "Live" },
    { name: "Landing — Defesa Penal",     url: "/defesa-penal",          speed: "88", sc: "#facc15", status: "Live" },
    { name: "Obrigado — Lead Captado",    url: "/obrigado",              speed: "99", sc: "#4ade80", status: "Live" },
    { name: "Landing — Prisão Flagrante", url: "/prisao-flagrante",      speed: "93", sc: "#4ade80", status: "Live" },
    { name: "Nova página",                url: "—",                      speed: "—",  sc: DS.muted,  status: "Em produção" },
  ];
  return (
    <div>
      <div style={{ color: DS.muted, fontSize: 10, marginBottom: 8, fontFamily: "Inter, sans-serif" }}>Clientes → Advocacia Torres → Páginas</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }}>
        <div>
          <div style={{ color: DS.primary, fontWeight: 700, fontSize: 13, fontFamily: "Inter, sans-serif" }}>Advocacia Torres</div>
          <div style={{ color: DS.muted, fontSize: 10, marginTop: 2, fontFamily: "Inter, sans-serif" }}>advocacia-torres.com · 8 páginas · performance média 93/100</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN }} />
          <span style={{ color: GREEN, fontSize: 10, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>Conectado</span>
        </div>
      </div>
      <div style={{ borderRadius: 8, border: `1px solid ${DS.border}`, overflow: "hidden" }}>
        {rows.map((r, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 12px",
            borderBottom: i < rows.length - 1 ? `1px solid ${DS.border}` : "none",
            background: i % 2 === 0 ? DS.card : "transparent",
          }}>
            <div>
              <div style={{ color: DS.sub, fontSize: 11, fontWeight: 500, fontFamily: "Inter, sans-serif" }}>{r.name}</div>
              <div style={{ color: DS.muted, fontSize: 9, marginTop: 1, fontFamily: "Inter, sans-serif" }}>{r.url}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ color: r.sc, fontSize: 11, fontWeight: 700, fontFamily: "Inter, sans-serif" }}>{r.speed !== "—" ? `${r.speed}/100` : "—"}</span>
              <span style={{
                color: r.status === "Live" ? GREEN : "rgba(255,180,50,0.9)",
                fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                background: r.status === "Live" ? `${GREEN}20` : "rgba(255,180,50,0.12)",
                fontFamily: "Inter, sans-serif",
              }}>{r.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DScreenPropostas() {
  const cols = [
    { label: "Em aberto",   color: "#facc15", cards: [{ client: "Dra. Roberta Fonseca", svc: "Landing Dir. Prev.",  val: "R$1.800" }] },
    { label: "Em produção", color: "#60a5fa", cards: [{ client: "Advocacia Torres",     svc: "Nova landing page",   val: "R$600" }, { client: "Dr. João Advogados", svc: "Obrigado + Upsell", val: "R$600" }] },
    { label: "Entregue",    color: GREEN,     cards: [{ client: "Escritório Silva",      svc: "Home + 2 Landings",  val: "R$1.800" }] },
  ];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <div style={{ color: DS.primary, fontWeight: 700, fontSize: 14, fontFamily: "Inter, sans-serif" }}>Propostas</div>
          <div style={{ color: DS.muted, fontSize: 10, marginTop: 2, fontFamily: "Inter, sans-serif" }}>Pipeline comercial · 4 propostas ativas</div>
        </div>
        <button style={{ padding: "5px 10px", borderRadius: 5, border: `1px solid ${GREEN}55`, background: `${GREEN}15`, color: GREEN, fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "Inter, sans-serif" }}>+ Nova</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
        {cols.map(col => (
          <div key={col.label}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: col.color }} />
              <span style={{ color: DS.muted, fontSize: 10, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>{col.label}</span>
              <span style={{ color: DS.muted, fontSize: 9, marginLeft: "auto", fontFamily: "Inter, sans-serif" }}>{col.cards.length}</span>
            </div>
            {col.cards.map((card, i) => (
              <div key={i} style={{ borderRadius: 7, border: `1px solid ${DS.border}`, background: DS.card, padding: "9px 11px", marginBottom: 6 }}>
                <div style={{ color: DS.primary, fontWeight: 600, fontSize: 11, fontFamily: "Inter, sans-serif" }}>{card.client}</div>
                <div style={{ color: DS.muted, fontSize: 9.5, margin: "3px 0 5px", fontFamily: "Inter, sans-serif" }}>{card.svc}</div>
                <div style={{ color: col.color, fontWeight: 700, fontSize: 12, fontFamily: "Inter, sans-serif" }}>{card.val}</div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function DScreenRecursos() {
  const cats = [
    { name: "Templates de Briefing", items: [
      { name: "Briefing — Landing Jurídica",    type: "PDF", dl: 12 },
      { name: "Briefing — Site Institucional",  type: "PDF", dl: 7  },
      { name: "Checklist de Entrega",           type: "PDF", dl: 19 },
    ]},
    { name: "Templates Elementor", items: [
      { name: "Kit Jurídico — Advocacia Criminal", type: "ZIP", dl: 24 },
      { name: "Kit Jurídico — Família",            type: "ZIP", dl: 18 },
      { name: "Kit — Previdenciário",              type: "ZIP", dl: 11 },
    ]},
  ];
  return (
    <div>
      <div style={{ color: DS.primary, fontWeight: 700, fontSize: 14, marginBottom: 3, fontFamily: "Inter, sans-serif" }}>Recursos</div>
      <div style={{ color: DS.muted, fontSize: 10, marginBottom: 16, fontFamily: "Inter, sans-serif" }}>Templates, briefings e arquivos do parceiro</div>
      {cats.map(cat => (
        <div key={cat.name} style={{ marginBottom: 18 }}>
          <div style={{ color: DS.muted, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8, fontFamily: "Inter, sans-serif" }}>{cat.name}</div>
          {cat.items.map(item => (
            <div key={item.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 11px", borderRadius: 6, border: `1px solid ${DS.border}`, background: DS.card, marginBottom: 5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13 }}>{item.type === "PDF" ? "📄" : "📦"}</span>
                <span style={{ color: DS.sub, fontSize: 11, fontFamily: "Inter, sans-serif" }}>{item.name}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: DS.muted, fontSize: 9.5, fontFamily: "Inter, sans-serif" }}>{item.dl} dl</span>
                <span style={{ padding: "2px 7px", borderRadius: 999, background: "rgba(255,255,255,0.05)", color: DS.muted, fontSize: 9, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>{item.type}</span>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DScreenComponentes() {
  const [filter, setFilter] = useState("Jurídico");
  const filters = ["Todos","Hero","CTA","Formulários","FAQ","Jurídico"];
  const components = [
    { name: "Hero — Advogado Dark",     cat: "Hero"       },
    { name: "CTA — Consulta Gratuita",  cat: "CTA"        },
    { name: "Form — Lead Jurídico",     cat: "Formulários" },
    { name: "Depoimentos — Ganhos",     cat: "Depoimentos" },
    { name: "FAQ — Dúvidas Jurídicas",  cat: "FAQ"        },
    { name: "Área de Prática — Cards",  cat: "Jurídico"   },
  ];
  return (
    <div>
      <div style={{ color: DS.primary, fontWeight: 700, fontSize: 13, marginBottom: 2, fontFamily: "Inter, sans-serif" }}>Biblioteca de Componentes</div>
      <div style={{ color: DS.muted, fontSize: 10, marginBottom: 11, fontFamily: "Inter, sans-serif" }}>2.900+ componentes prontos pra usar no Elementor</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
        {filters.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "3px 9px", borderRadius: 999,
            border: f === filter ? `1px solid ${GREEN}66` : `1px solid ${DS.border}`,
            background: f === filter ? `${GREEN}18` : "transparent",
            color: f === filter ? GREEN : DS.muted,
            fontSize: 9.5, fontWeight: 600, cursor: "pointer",
            fontFamily: "Inter, sans-serif",
          }}>{f}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
        {components.map(c => (
          <div key={c.name} style={{ borderRadius: 7, border: `1px solid ${DS.border}`, overflow: "hidden" }}>
            <div style={{
              height: 52,
              background: `linear-gradient(135deg, ${BG3}, ${GREEN}22)`,
            }} />
            <div style={{ padding: "7px 9px", background: BG2 }}>
              <div style={{ color: DS.sub, fontSize: 9.5, fontWeight: 600, fontFamily: "Inter, sans-serif" }}>{c.name}</div>
              <div style={{ color: DS.muted, fontSize: 8.5, marginTop: 1, fontFamily: "Inter, sans-serif" }}>{c.cat}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PREÇO ────────────────────────────────────────────────────────────────────

function PricingSection() {
  const criacaoTags = [
    "Construída no Elementor", "Design responsivo", "Revisões inclusas",
    "White label", "Entrega em 3 dias",
  ];
  const acompTags = [
    "Monitoramento diário", "Correção de bugs", "Otimização de performance",
    "Ajustes de copy", "Relatório de métricas", "Suporte WhatsApp", "Até 10 projetos",
  ];

  return (
    <section id="preco" style={{ padding: "80px 0" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 48px" }}>
        <Reveal style={{ marginBottom: 48 }}>
          <Eyebrow>Entregáveis e investimento</Eyebrow>
          <motion.h2
            variants={vFadeUp}
            style={{
              fontFamily: "Inter, sans-serif",
              fontSize: "clamp(28px, 4vw, 46px)", fontWeight: 700,
              lineHeight: 1.08, letterSpacing: "-0.03em", color: TEXT_1,
              margin: "16px 0 16px",
            }}
          >
            Preço fixo.<br />
            <span style={{ color: GREEN }}>Sem surpresas.</span>
          </motion.h2>
          <motion.p variants={vFadeUp} style={{
            fontFamily: "Inter, sans-serif", fontSize: 16, color: TEXT_2,
            maxWidth: 560, lineHeight: 1.7,
          }}>
            A Ousen sabe exatamente o custo antes de fechar qualquer contrato. Sem variação, sem negociação a cada projeto.
          </motion.p>
        </Reveal>

        <Reveal>
          <motion.div
            variants={vFadeUp}
            style={{
              border: `1px solid ${BORDER2}`, borderRadius: 10, overflow: "hidden",
              marginBottom: 28,
            }}
          >
            {/* Header */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 2fr 130px",
              background: BG2, borderBottom: `1px solid ${BORDER}`,
            }}>
              {["Entregável", "O que está incluso", "Valor"].map((h, i) => (
                <div key={h} style={{
                  padding: "11px 18px",
                  fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  color: TEXT_3, textAlign: i === 2 ? "center" : "left",
                  borderLeft: i > 0 ? `1px solid ${BORDER}` : "none",
                }}>{h}</div>
              ))}
            </div>

            {[
              { name: "Criação de página",       tags: criacaoTags, price: "R$600", period: "/ página" },
              { name: "Acompanhamento mensal",   tags: acompTags,   price: "R$99",  period: "/ mês" },
            ].map((row, ri) => (
              <motion.div
                key={row.name}
                whileHover={{ backgroundColor: BG3 }}
                style={{
                  display: "grid", gridTemplateColumns: "1fr 2fr 130px",
                  background: ri % 2 === 0 ? BG : BG2,
                  borderBottom: ri === 0 ? `1px solid ${BORDER}` : "none",
                  transition: "background 0.15s",
                }}
              >
                <div style={{ padding: "18px 18px", display: "flex", alignItems: "flex-start" }}>
                  <span style={{
                    fontFamily: "Inter, sans-serif", fontSize: 14,
                    fontWeight: 600, color: TEXT_1,
                  }}>{row.name}</span>
                </div>
                <div style={{ padding: "16px 18px", borderLeft: `1px solid ${BORDER}`, display: "flex", flexWrap: "wrap", gap: 5, alignContent: "flex-start" }}>
                  {row.tags.map(tag => (
                    <span key={tag} style={{
                      padding: "2px 9px", borderRadius: 100,
                      border: `1px solid ${BORDER2}`, background: BG3,
                      fontFamily: "Inter, sans-serif", fontSize: 11, color: TEXT_2,
                    }}>{tag}</span>
                  ))}
                </div>
                <div style={{
                  padding: "18px 18px", borderLeft: `1px solid ${BORDER}`,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{
                    fontFamily: "Inter, sans-serif", fontSize: 22,
                    color: GREEN, fontWeight: 700, lineHeight: 1,
                  }}>{row.price}</span>
                  <span style={{
                    fontFamily: "Inter, sans-serif", fontSize: 11,
                    color: TEXT_3, marginTop: 3,
                  }}>{row.period}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Bloco de margem 60% */}
          <motion.div
            variants={vFadeUp}
            style={{
              background: GREEN, borderRadius: 10, padding: "32px 36px",
              display: "grid", gridTemplateColumns: "1fr auto", gap: 32, alignItems: "center",
            }}
            className="spo-margin-grid"
          >
            <div>
              <div style={{
                fontFamily: "Inter, sans-serif", fontSize: 10, fontWeight: 700,
                letterSpacing: "0.12em", textTransform: "uppercase",
                color: "rgba(0,0,0,0.45)", marginBottom: 10,
              }}>Exemplo de margem</div>
              <p style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 700, fontSize: 20, color: "#111",
                lineHeight: 1.3, margin: "0 0 10px",
              }}>
                A Ousen cobra R$1.500 do cliente
              </p>
              <p style={{
                fontFamily: "Inter, sans-serif", fontSize: 14, lineHeight: 1.65,
                color: "rgba(0,0,0,0.6)", margin: 0,
              }}>
                Paga R$600 pra nós → fica com <strong style={{ color: "#111" }}>R$900 líquido</strong> sem produzir nada, sem contratar ninguém, sem gerenciar um designer.
              </p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{
                fontFamily: "Inter, sans-serif", fontSize: 54, fontWeight: 800,
                color: "#111", lineHeight: 1, letterSpacing: "-0.04em",
              }}>60%</div>
              <div style={{
                fontFamily: "Inter, sans-serif", fontSize: 12,
                color: "rgba(0,0,0,0.5)", marginTop: 4,
              }}>de margem líquida<br />por página</div>
            </div>
          </motion.div>
        </Reveal>
      </div>
    </section>
  );
}


// ─── FOOTER ───────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer style={{
      maxWidth: 1100, margin: "0 auto", padding: "24px 48px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: 12,
    }}>
      <LogoSVG size={18} />
      <span style={{
        fontFamily: "Inter, sans-serif", fontSize: 12, color: TEXT_3,
      }}>Proposta exclusiva · Ousen × SuperElements · 2026</span>
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

  @media (max-width: 860px) {
    .spo-hero-grid    { grid-template-columns: 1fr !important; }
    .spo-hero-aside   { display: none !important; }
    .spo-sol-grid     { grid-template-columns: 1fr !important; gap: 32px !important; }
    .spo-process-sticky { position: static !important; }
    .spo-pain-grid    { grid-template-columns: 1fr !important; }
    .spo-closing-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
    .spo-margin-grid  { grid-template-columns: 1fr !important; }
    .spo-hide-mobile  { display: none !important; }
  }
  @media (max-width: 700px) {
    .spo-dash-sidebar { display: none !important; }
  }
`;

// ─── PAGE ROOT ────────────────────────────────────────────────────────────────

export default function StudioPartnersOusen() {
  useEffect(() => {
    const el = document.createElement("style");
    el.id = "sp-ousen-styles";
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
    return () => { document.getElementById("sp-ousen-styles")?.remove(); };
  }, []);

  return (
    <div
      id="sp-ousen-root"
      style={{
        minHeight: "100vh",
        background: BG,
        color: TEXT_1,
        fontFamily: "Inter, sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <Nav />
      <Hero />

      <div style={{ padding: "40px 0 48px" }}>
        <SectionDivider label="O problema" />
      </div>

      <ProblemSection />

      <div style={{ padding: "40px 0 48px" }}>
        <SectionDivider label="A solução" />
      </div>

      <SolutionSection />

      <div style={{ padding: "40px 0 48px" }}>
        <SectionDivider label="Investimento" />
      </div>

      <PricingSection />

      <Footer />
    </div>
  );
}
