const switcher = document.querySelector(".switcher");
const bubble = document.querySelector(".switcher__bubble");
const options = document.querySelectorAll(".switcher__option");
const inputs = document.querySelectorAll(".switcher__input");

let isDragging = false;
let currentActiveIndex = 0;
let hideTimeout = null;
let slideTimeout = null;

// Khởi tạo vị trí
inputs.forEach((input, index) => {
  if (input.checked) currentActiveIndex = index;
});

function getOptionX(index) {
  const rect = options[index].getBoundingClientRect();
  const parentRect = switcher.getBoundingClientRect();
  return rect.left - parentRect.left + (rect.width - bubble.offsetWidth) / 2;
}

// Lưu vị trí cuối cùng
let currentX = getOptionX(currentActiveIndex);
bubble.style.translate = `${currentX}px 0`;

function animateToTarget(targetIndex) {
  clearTimeout(hideTimeout);
  clearTimeout(slideTimeout);

  const targetX = getOptionX(targetIndex);

  // Bước 1: Trở về vị trí cũ một cách thầm lặng nếu đang tàng hình
  bubble.classList.add("no-transition");
  bubble.style.translate = `${currentX}px 0`;
  bubble.style.scale = "1 1";

  // Ép trình duyệt nhận diện vị trí cũ
  void bubble.offsetWidth;

  // Bước 2: Bật transition, hiện lên và phình to
  bubble.classList.remove("no-transition");
  bubble.classList.add("is-visible");
  bubble.style.scale = "1.3 1.3";

  // Bước 3: Đợi một chút cho hiệu ứng phình to rõ ràng rồi mới trượt
  slideTimeout = setTimeout(() => {
    currentX = targetX;
    bubble.style.translate = `${currentX}px 0`;

    // Bước 4: Đợi trượt gần xong thì bắt đầu thu nhỏ
    slideTimeout = setTimeout(() => {
      bubble.style.scale = "1 1";

      // Bước 5: Ẩn đi sau khi thu nhỏ
      hideTimeout = setTimeout(() => {
        if (!isDragging) bubble.classList.remove("is-visible");
      }, 300);
    }, 450); // Mất khoảng 600ms để trượt, ta kích hoạt thu nhỏ ở 450ms (gần sát đích)
  }, 100);
}

inputs.forEach((input, index) => {
  input.addEventListener("change", (e) => {
    // Không chạy lại animation nếu là do auto trigger từ drag
    if (e.detail === "auto") return;

    if (!isDragging) {
      animateToTarget(index);
      currentActiveIndex = index;
    }
  });
});

switcher.addEventListener("pointerdown", (e) => {
  // Bỏ qua nếu không phải chuột trái hoặc chạm ngón tay
  if (e.pointerType === "mouse" && e.button !== 0) return;

  isDragging = true;
  clearTimeout(hideTimeout);
  clearTimeout(slideTimeout);

  bubble.classList.remove("no-transition");
  bubble.classList.add("is-visible", "is-dragging");

  const rect = switcher.getBoundingClientRect();
  let x = e.clientX - rect.left - bubble.offsetWidth / 2;
  x = Math.max(-10, Math.min(rect.width - bubble.offsetWidth + 10, x));

  currentX = x;
  bubble.style.translate = `${currentX}px 0`;
  // Phình to ngay lập tức
  bubble.style.scale = "1.2 1.4";

  // Capture pointer để đảm bảo nhận được sự kiện kể cả khi trượt ra ngoài
  switcher.setPointerCapture(e.pointerId);

  const moveHandler = (e) => {
    let x = e.clientX - rect.left - bubble.offsetWidth / 2;
    x = Math.max(-10, Math.min(rect.width - bubble.offsetWidth + 10, x));
    currentX = x;
    bubble.style.translate = `${currentX}px 0`;
  };

  const upHandler = (e) => {
    isDragging = false;
    switcher.releasePointerCapture(e.pointerId);
    switcher.removeEventListener("pointermove", moveHandler);
    switcher.removeEventListener("pointerup", upHandler);
    switcher.removeEventListener("pointercancel", upHandler);

    bubble.classList.remove("is-dragging");

    // Tìm vị trí gần nhất
    let nearestIndex = 0;
    let minDistance = Infinity;
    const bubbleCenterX = currentX + bubble.offsetWidth / 2;

    options.forEach((opt, idx) => {
      const optRect = opt.getBoundingClientRect();
      const relCenter = optRect.left - rect.left + optRect.width / 2;
      const dist = Math.abs(bubbleCenterX - relCenter);
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = idx;
      }
    });

    const radio = inputs[nearestIndex];
    if (!radio.checked) {
      radio.checked = true;
      radio.dispatchEvent(
        new CustomEvent("change", { bubbles: true, detail: "auto" }),
      );
    }
    currentActiveIndex = nearestIndex;

    // Trượt nốt phần còn lại về tâm icon
    currentX = getOptionX(nearestIndex);
    bubble.style.translate = `${currentX}px 0`;

    // Bắt đầu thu nhỏ
    setTimeout(() => {
      bubble.style.scale = "1 1";
      hideTimeout = setTimeout(() => {
        if (!isDragging) bubble.classList.remove("is-visible");
      }, 300);
    }, 150);
  };

  switcher.addEventListener("pointermove", moveHandler);
  switcher.addEventListener("pointerup", upHandler);
  switcher.addEventListener("pointercancel", upHandler);
});

// Chặn click mặc định của label để không double fire
inputs.forEach((input) => {
  input.addEventListener("click", (e) => e.stopPropagation());
});

switcher.addEventListener("dragstart", (e) => e.preventDefault());

// Ngăn chặn trình duyệt di động (như Safari) cố tình cuộn trang khi vuốt trên thanh tab
switcher.addEventListener("touchmove", (e) => {
  if (isDragging) {
    e.preventDefault();
  }
}, { passive: false });

// Theo dõi chuột để tạo hiệu ứng ánh sáng 7 màu trên bong bóng
window.addEventListener("pointermove", (e) => {
  const rect = bubble.getBoundingClientRect();

  // Tính tọa độ chuột tương đối so với tâm của bong bóng
  let rx = (e.clientX - rect.left) / rect.width;
  let ry = (e.clientY - rect.top) / rect.height;

  // Cập nhật biến CSS để đổi hướng gradient
  bubble.style.setProperty("--rx", rx);
  bubble.style.setProperty("--ry", ry);
});
