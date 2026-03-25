import React, { useCallback } from 'react';

interface DraggableResizerProps {
  onResize: (delta: number) => void;
}

const DraggableResizer: React.FC<DraggableResizerProps> = ({ onResize }) => {
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    const handleMouseMove = (moveEvent: MouseEvent) => {
      onResize(moveEvent.movementX);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [onResize]);

  return (
    <div
      onMouseDown={handleMouseDown}
      className="w-1.5 h-full bg-gray-700 cursor-col-resize hover:bg-blue-600 transition-colors"
    />
  );
};

export default DraggableResizer;
