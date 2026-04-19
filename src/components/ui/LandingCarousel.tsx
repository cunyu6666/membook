/**
 * [WHO]: 提供 LandingCarousel 图片轮播组件
 * [FROM]: 依赖 react, lib/utils
 * [TO]: 被 pages/LandingPage.tsx 消费
 * [HERE]: src/components/ui/，与同级 UI 组件相邻
 */
import { useEffect, useState, useCallback } from "react";
import { cn } from "../../lib/utils";

const IMAGES = [
  {
    id: "1",
    src: "https://images.pexels.com/photos/5637531/pexels-photo-5637531.jpeg?w=400&h=500&fit=crop",
    alt: "Elderly couple sharing a happy moment with flowers",
    rotation: -6,
  },
  {
    id: "2",
    src: "https://images.pexels.com/photos/5637718/pexels-photo-5637718.jpeg?w=400&h=500&fit=crop",
    alt: "Elderly couple standing outside their home together",
    rotation: 4,
  },
  {
    id: "3",
    src: "https://images.pexels.com/photos/7799597/pexels-photo-7799597.jpeg?w=400&h=500&fit=crop",
    alt: "Elderly couple with their grandchildren doing crafts",
    rotation: -3,
  },
  {
    id: "4",
    src: "https://images.pexels.com/photos/7799599/pexels-photo-7799599.jpeg?w=400&h=500&fit=crop",
    alt: "Grandfather sharing a moment with grandchildren",
    rotation: 5,
  },
  {
    id: "5",
    src: "https://images.pexels.com/photos/5637710/pexels-photo-5637710.jpeg?w=400&h=500&fit=crop",
    alt: "Elderly couple standing outside their house",
    rotation: -4,
  },
  {
    id: "6",
    src: "https://images.pexels.com/photos/3753009/pexels-photo-3753009.jpeg?w=400&h=500&fit=crop",
    alt: "Senior friends chatting at a table",
    rotation: 3,
  },
];

export function LandingCarousel() {
  const [angles, setAngles] = useState<number[]>([]);
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 });

  // Continuous rotation
  useEffect(() => {
    const init = IMAGES.map((_, i) => i * (360 / IMAGES.length));
    setAngles(init);
    const id = setInterval(() => {
      setAngles((prev) => prev.map((a) => (a + 0.4) % 360));
    }, 50);
    return () => clearInterval(id);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setMousePos({
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height,
      });
    },
    [],
  );

  return (
    <div className="relative w-full">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-gradient-to-br from-primary/5 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-gradient-to-tr from-accent/5 to-transparent blur-3xl" />
      </div>

      {/* Carousel */}
      <div
        className="relative h-80 w-full sm:h-96 md:h-[28rem]"
        onMouseMove={handleMouseMove}
      >
        <div className="absolute inset-0 flex items-center justify-center">
          {IMAGES.map((img, i) => {
            const rad = angles[i] * (Math.PI / 180);
            const radius = 160;
            const x = Math.cos(rad) * radius;
            const y = Math.sin(rad) * (radius * 0.45);
            const px = (mousePos.x - 0.5) * 12;
            const py = (mousePos.y - 0.5) * 12;
            const scale = 1 + Math.sin(rad) * 0.15;
            const zIndex = Math.round((Math.sin(rad) + 1) * 10);

            return (
              <div
                key={img.id}
                className="absolute h-32 w-28 transition-[transform,scale] duration-300 sm:h-44 sm:w-36 md:h-52 md:w-40"
                style={{
                  transform: `translate(${x}px, ${y}px) scale(${scale}) rotateX(${py}deg) rotateY(${px}deg) rotate(${img.rotation}deg)`,
                  zIndex,
                }}
              >
                <div
                  className={cn(
                    "group relative h-full w-full overflow-hidden rounded-2xl shadow-xl",
                    "transition-shadow duration-300 hover:shadow-2xl",
                  )}
                >
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading={i > 2 ? "lazy" : "eager"}
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
