import React, { useEffect, useRef, useState } from 'react';
import './Taskbar.css';

const BottomTaskbar = ({ activeTab, setActiveTab }) => {
  const switcherRef = useRef(null);
  const bubbleRef = useRef(null);
  const optionsRef = useRef([]);

  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const hideTimeoutRef = useRef(null);
  const slideTimeoutRef = useRef(null);
  const currentXRef = useRef(0);
  const currentActiveIndexRef = useRef(0);

  const tabs = ['main', 'history', 'profile'];

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  useEffect(() => {
    currentActiveIndexRef.current = tabs.indexOf(activeTab);
  }, [activeTab]);

  useEffect(() => {
    const switcher = switcherRef.current;
    const bubble = bubbleRef.current;
    const options = optionsRef.current;

    if (!switcher || !bubble || options.length !== 3) return;

    function getOptionX(index) {
      if (!options[index]) return 0;
      const rect = options[index].getBoundingClientRect();
      const parentRect = switcher.getBoundingClientRect();
      return rect.left - parentRect.left + (rect.width - bubble.offsetWidth) / 2;
    }

    // Initialize position
    // Delay initialization slightly to let CSS/fonts load
    setTimeout(() => {
        currentXRef.current = getOptionX(currentActiveIndexRef.current);
        bubble.style.translate = `${currentXRef.current}px 0`;
    }, 100);

    function animateToTarget(targetIndex) {
      clearTimeout(hideTimeoutRef.current);
      clearTimeout(slideTimeoutRef.current);

      const targetX = getOptionX(targetIndex);

      // Bước 1: Trở về vị trí cũ một cách thầm lặng nếu đang tàng hình
      bubble.classList.add("no-transition");
      bubble.style.translate = `${currentXRef.current}px 0`;
      bubble.style.scale = "1 1";

      // Ép trình duyệt nhận diện vị trí cũ
      void bubble.offsetWidth;

      // Bước 2: Bật transition, hiện lên và phình to
      bubble.classList.remove("no-transition");
      bubble.classList.add("is-visible");
      bubble.style.scale = "1.3 1.3";

      // Bước 3: Đợi một chút cho hiệu ứng phình to rõ ràng rồi mới trượt
      slideTimeoutRef.current = setTimeout(() => {
        currentXRef.current = targetX;
        bubble.style.translate = `${currentXRef.current}px 0`;

        // Bước 4: Đợi trượt gần xong thì bắt đầu thu nhỏ
        slideTimeoutRef.current = setTimeout(() => {
          bubble.style.scale = "1 1";

          // Bước 5: Ẩn đi sau khi thu nhỏ
          hideTimeoutRef.current = setTimeout(() => {
            if (!isDraggingRef.current) bubble.classList.remove("is-visible");
          }, 300);
        }, 450);
      }, 100);
    }

    const handleTabChange = (index) => {
      if (!isDraggingRef.current) {
        animateToTarget(index);
        setActiveTab(tabs[index]);
      }
    };

    options.forEach((opt, index) => {
      opt.onclick = () => handleTabChange(index);
    });

    const pointerDownHandler = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;

      setIsDragging(true);
      clearTimeout(hideTimeoutRef.current);
      clearTimeout(slideTimeoutRef.current);

      bubble.classList.remove("no-transition");
      bubble.classList.add("is-visible", "is-dragging");

      const rect = switcher.getBoundingClientRect();
      let x = e.clientX - rect.left - bubble.offsetWidth / 2;
      x = Math.max(-10, Math.min(rect.width - bubble.offsetWidth + 10, x));

      currentXRef.current = x;
      bubble.style.translate = `${currentXRef.current}px 0`;
      bubble.style.scale = "1.2 1.4";

      switcher.setPointerCapture(e.pointerId);

      const moveHandler = (e) => {
        let x = e.clientX - rect.left - bubble.offsetWidth / 2;
        x = Math.max(-10, Math.min(rect.width - bubble.offsetWidth + 10, x));
        currentXRef.current = x;
        bubble.style.translate = `${currentXRef.current}px 0`;
      };

      const upHandler = (e) => {
        setIsDragging(false);
        switcher.releasePointerCapture(e.pointerId);
        switcher.removeEventListener("pointermove", moveHandler);
        switcher.removeEventListener("pointerup", upHandler);
        switcher.removeEventListener("pointercancel", upHandler);

        bubble.classList.remove("is-dragging");

        let nearestIndex = 0;
        let minDistance = Infinity;
        const bubbleCenterX = currentXRef.current + bubble.offsetWidth / 2;

        options.forEach((opt, idx) => {
          const optRect = opt.getBoundingClientRect();
          const relCenter = optRect.left - rect.left + optRect.width / 2;
          const dist = Math.abs(bubbleCenterX - relCenter);
          if (dist < minDistance) {
            minDistance = dist;
            nearestIndex = idx;
          }
        });

        setActiveTab(tabs[nearestIndex]);
        currentActiveIndexRef.current = nearestIndex;

        currentXRef.current = getOptionX(nearestIndex);
        bubble.style.translate = `${currentXRef.current}px 0`;

        setTimeout(() => {
          bubble.style.scale = "1 1";
          hideTimeoutRef.current = setTimeout(() => {
            if (!isDraggingRef.current) bubble.classList.remove("is-visible");
          }, 300);
        }, 150);
      };

      switcher.addEventListener("pointermove", moveHandler);
      switcher.addEventListener("pointerup", upHandler);
      switcher.addEventListener("pointercancel", upHandler);
    };

    switcher.addEventListener("pointerdown", pointerDownHandler);
    switcher.addEventListener("dragstart", (e) => e.preventDefault());
    switcher.addEventListener("touchmove", (e) => {
      if (isDraggingRef.current) e.preventDefault();
    }, { passive: false });

    const globalMoveHandler = (e) => {
      const rect = bubble.getBoundingClientRect();
      let rx = (e.clientX - rect.left) / rect.width;
      let ry = (e.clientY - rect.top) / rect.height;
      bubble.style.setProperty("--rx", rx);
      bubble.style.setProperty("--ry", ry);
    };
    window.addEventListener("pointermove", globalMoveHandler);

    return () => {
      switcher.removeEventListener("pointerdown", pointerDownHandler);
      window.removeEventListener("pointermove", globalMoveHandler);
    };
  }, []);

  return (
    <div className="switcher-container">
      <fieldset className="switcher" ref={switcherRef}>
        
        <label className="switcher__option" ref={el => optionsRef.current[0] = el}>
          <input
            className="switcher__input"
            type="radio"
            name="theme"
            value="main"
            checked={activeTab === 'main'}
            readOnly
          />
          <svg className="switcher__icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <path fill="var(--c)" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
          <span>Nhà</span>
        </label>

        <label className="switcher__option" ref={el => optionsRef.current[1] = el}>
          <input
            className="switcher__input"
            type="radio"
            name="theme"
            value="history"
            checked={activeTab === 'history'}
            readOnly
          />
          <svg className="switcher__icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <path fill="var(--c)" d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/>
          </svg>
          <span>Lịch sử</span>
        </label>

        <label className="switcher__option" ref={el => optionsRef.current[2] = el}>
          <input
            className="switcher__input"
            type="radio"
            name="theme"
            value="profile"
            checked={activeTab === 'profile'}
            readOnly
          />
          <svg className="switcher__icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <path fill="var(--c)" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
          <span>Cá nhân</span>
        </label>

        <div className="switcher__filter">
          <svg>
            <filter id="switcher-filter" primitiveUnits="objectBoundingBox">
              <feImage result="map" width="100%" height="100%" x="0" y="0" href="data:image/webp;base64,UklGRq4vAABXRUJQVlA4WAoAAAAQAAAA5wEAhwAAQUxQSOYWAAABHAVpGzCrf9t7EiJCYdIGTDpvURGm9n7K+YS32rZ1W8q0LSSEBCQgAQlIwEGGA3CQOAAHSEDCJSEk4KDvUmL31vrYkSX3ufgXEb4gSbKt2LatxlqIgNBBzbM3ikHVkvUvq7btKpaOBCQgIRIiAQeNg46DwgE4oB1QDuKgS0IcXBykXieHkwdjX/4iAhZtK3ErSBYGEelp+4aM/5/+z14+//jLlz/++s/Xr4//kl9C8Ns8DaajU+lPX/74+viv/eWxOXsO+eHL3/88/ut/2b0zref99evjX8NLmNt1fP7178e/jJcw9k3G//XP49/Iy2qaa7328Xkk9ZnWx0VUj3bcyCY4Pi7C6reeEagEohnRCbQQwFmUp9ggYQj8MChjTSI0Ck7G/bh6P5ykNU9yP+10G8I2UAwXeQ96DQwNjqyPu/c4tK+5CtGOK0oM7AH5f767lHpotXVYYI66B+HjMhHj43C5wok3YDH4/vZFZRkB7rNnEfC39WS2Q3K78y525wFNTPf5f+/fN9YI1YyDvjuzV5rQtsfn1Ez1ka3PkeGxOZ6IODxDJqCLpF7vdb9Z3s/ufLr6jf/55zbW3LodwwVVg7Lmao+p3eGcqDFDGuuKnlBZAPSbnkYtTX+mZl2y57Gq85F3tDv7m7/yzpjXHoVA3YUObsHz80W3IUK1E8yRqggxTMzD4If2230ys7RDxWrLu9o9GdSWNwNRC2yMIg+HkTVT3BOZER49XLBMdljemLFMjw8VwZ8OdBti4lWdt7c7dzaSc5yILtztsTMT1GFGn/tysM23nF3xbOsnh/eQGKkxhWGEalljCvWZ+LDE+9t97uqEfb08rdYwZGhheLzG2SJzKS77OIAVgPDjf9jHt6c+0mjinS/v13iz9RV3vsPdmbNG1E+nD6s83jBrBEnlBiTojuJogGJNtzxtsIoD2CFuXYipzhGWHhWqCBSqd7l7GMrnuHzH6910FO+XYwgcDxoFRJNk2GUcpQ6I/GhLmqisuBS6uSFpfAz3Yb9Yatyed7r781ZYfr3+3FfXs1MykSbVcg4GiOKX19SZ9xFRwhG+UZGiROjsXhePVu12fCZTJ3CJ4Z3uXnyxz28RutHa5yCKG6jgfTBPuA9jHL7YdlAa2trNEr7BLANd3qNYcWZqnkvlDe8+F5Q/9k8jCFk17ObrIf0O/5U/iDnqcqA70mURr8FUN5pmQEzDcxuWvOPd1+KrbO4fd0vXK5OTtYEy5C2TA5L4ok6Y31WHR9ZR9lQr6IjwruSd775W6NVa2zz1fir2k1GWnT573Eu3mfMjIikYZkM4MDCnTWbmLrpK/Hs0KD5C8rZ3n0tnw0j76WuU8P1YBIjsvcESbnOQMY+gGC/sd/gG+hKKtDijJHhrcSj/GHa/FZ8oGLXeLx1IW+cgU8pqD0PzMzU3oG5lQ/ZaDPDMYq+aAPSEmHN+JiVIp0haHTvPt77732z5ed2K7NHs9FtCIk4BdNkKLRLvOKlFcw+UiovM4OB5sGgepyML+a4TEu/I29/dFtjJulojJR4Tg71ybApEdca0TSnaumNJyCWH2pjENASlQS/NIXMWtiPV9CHsvuftev08/lemYIcUnHSu6XEMvaBq41tqf/m0siLj7xeXsnBmhxY5z+nCwX4Iu4euTPaE4EQorgogisHrBtsAMdX+Huje7nlx3hMpKovdf+YftDQqytChXfEh7D5nyC8rzNTICINmpK5Ni0ngcAMzpmiYDwOMtmUTiCjvx2S2dIeSguP/QHZ3xYIeGhTt1CsCOIiEuVw8pGjVznDJppuojl30i9RvXccXzmXGj2b3H3XM38c/PZseyeOdplXhFekzZMZ2fUGuIBsKCcgQg4Ikqt4PDTkQiWQtMUBFAEhUH8vuvoAvnvGMCEP4/vMmZA2Pn" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.04" result="blur" />
              <feDisplacementMap id="disp" in="blur" in2="map" scale="0.5" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap>
            </filter>
          </svg>
        </div>
        <div className="switcher__bubble" ref={bubbleRef}></div>
      </fieldset>
    </div>
  );
};

export default BottomTaskbar;
