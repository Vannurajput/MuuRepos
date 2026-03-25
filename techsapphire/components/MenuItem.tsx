import React from 'react';
import Icon from './Icon';

interface MenuItemProps {
  onClick?: () => void;
  children?: React.ReactNode;
  type?: 'button' | 'separator' | 'checkbox';
  checked?: boolean;
  disabled?: boolean;
  shortcut?: string;
  className?: string;
  closeMenu?: () => void; // Injected by Menu component
}

const MenuItem: React.FC<MenuItemProps> = ({ onClick, children, type = 'button', checked = false, disabled = false, shortcut, className, closeMenu }) => {
  if (type === 'separator') {
    return <div className="h-px my-1 bg-gray-600" role="separator"></div>;
  }

  const handleClick = () => {
    if (disabled) return;
    if (onClick) {
      onClick();
    }
    // Don't close menu if it's a submenu trigger, the submenu itself will handle clicks.
    if (closeMenu && !className?.includes('group/submenu')) {
      closeMenu();
    }
  };

  const baseClasses = "flex items-center w-full px-3 py-1.5 text-sm text-left";
  const stateClasses = disabled 
    ? "text-gray-500 cursor-not-allowed" 
    : "text-gray-200 hover:bg-gray-600 cursor-pointer";

  return (
    <button onClick={handleClick} className={`${baseClasses} ${stateClasses} ${className || ''}`} role="menuitem" disabled={disabled}>
      <div className="flex items-center flex-1">
        <span className="w-4 h-4 mr-2 text-left">
          {type === 'checkbox' && checked && <Icon name="check" className="w-4 h-4" />}
        </span>
        <span className="flex-1">{children}</span>
      </div>
      {shortcut && <span className="text-xs text-gray-500">{shortcut}</span>}
    </button>
  );
};

export default MenuItem;