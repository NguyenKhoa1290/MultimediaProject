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

  const tabs = ['main', 'groups', 'profile'];

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

    setTimeout(() => {
        currentXRef.current = getOptionX(currentActiveIndexRef.current);
        bubble.style.translate = `${currentXRef.current}px 0`;
    }, 100);

    function animateToTarget(targetIndex) {
      clearTimeout(hideTimeoutRef.current);
      clearTimeout(slideTimeoutRef.current);
      const targetX = getOptionX(targetIndex);
      bubble.classList.add("no-transition");
      bubble.style.translate = `${currentXRef.current}px 0`;
      bubble.style.scale = "1 1";
      void bubble.offsetWidth;
      bubble.classList.remove("no-transition");
      bubble.classList.add("is-visible");
      bubble.style.scale = "1.3 1.3";

      slideTimeoutRef.current = setTimeout(() => {
        currentXRef.current = targetX;
        bubble.style.translate = `${currentXRef.current}px 0`;
        slideTimeoutRef.current = setTimeout(() => {
          bubble.style.scale = "1 1";
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
      if (opt) opt.onclick = () => handleTabChange(index);
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
    };

    switcher.addEventListener("pointerdown", pointerDownHandler);
    const globalMoveHandler = (e) => {
      const rect = bubble.getBoundingClientRect();
      let rx = (e.clientX - rect.left) / rect.width;
      let ry = (e.clientY - rect.top) / rect.height;
      bubble.style.setProperty("--rx", rx);
      bubble.style.setProperty("--ry", ry);
    };
    window.addEventListener("pointermove", globalMoveHandler);

    return () => {
      if (switcher) switcher.removeEventListener("pointerdown", pointerDownHandler);
      window.removeEventListener("pointermove", globalMoveHandler);
    };
  }, []);

  return (
    <div className="switcher-container">
      <fieldset className="switcher" ref={switcherRef}>
        
        <label className="switcher__option" ref={el => optionsRef.current[0] = el}>
          <input className="switcher__input" type="radio" name="nav" value="main" checked={activeTab === 'main'} readOnly />
          <svg className="switcher__icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <path fill="var(--c)" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
          </svg>
          <span>Nhà</span>
        </label>

        <label className="switcher__option" ref={el => optionsRef.current[1] = el}>
          <input className="switcher__input" type="radio" name="nav" value="groups" checked={activeTab === 'groups'} readOnly />
          <svg className="switcher__icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <path fill="var(--c)" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
          </svg>
          <span>Nhóm</span>
        </label>

        <label className="switcher__option" ref={el => optionsRef.current[2] = el}>
          <input className="switcher__input" type="radio" name="nav" value="profile" checked={activeTab === 'profile'} readOnly />
          <svg className="switcher__icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <path fill="var(--c)" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
          </svg>
          <span>Cá nhân</span>
        </label>

        <div className="switcher__filter">
          <svg><filter id="switcher-filter" primitiveUnits="objectBoundingBox"><feGaussianBlur stdDeviation="0.04" /></filter></svg>
        </div>
        <div className="switcher__bubble" ref={bubbleRef}></div>
      </fieldset>
    </div>
  );
};

export default BottomTaskbar;
