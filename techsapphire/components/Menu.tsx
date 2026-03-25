
import React, { useState, useRef, useCallback } from 'react';
import useOnClickOutside from '../hooks/useOnClickOutside';

interface MenuProps {
  label: string;
  children: React.ReactNode;
  menuPosition?: 'top' | 'left';
}

const Menu: React.FC<MenuProps> = ({ label, children, menuPosition = 'top' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setIsOpen(false), []);
  useOnClickOutside(menuRef, closeMenu);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeMenu();
    }
  };

  const dropdownPositionClasses = menuPosition === 'top'
    ? 'origin-top-left left-0 mt-1'
    : 'origin-top-left left-full top-0 ml-1';

  return (
    <div ref={menuRef} className="relative" onKeyDown={handleKeyDown}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className="w-full px-3 py-1 text-sm text-left text-gray-200 rounded-md hover:bg-gray-700 focus:outline-none focus:bg-gray-700"
      >
        {label}
      </button>
      {isOpen && (
        <div
          role="menu"
          className={`absolute z-50 w-56 py-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg ${dropdownPositionClasses}`}
        >
          {React.Children.map(children, child => 
            React.isValidElement(child) ? React.cloneElement(child, { closeMenu } as any) : child
          )}
        </div>
      )}
    </div>
  );
};

export default Menu;
