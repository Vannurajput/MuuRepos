import React, { useMemo } from 'react';
import { FileTab } from '../types';
import Icon from './Icon';

const PLACEHOLDER_FILENAME = '.placeholder';

interface PropertiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetPath: string | null;
  allFiles: FileTab[];
}

const formatBytes = (bytes: number, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

const DetailRow: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div className="grid grid-cols-3 gap-4">
    <dt className="text-sm font-medium text-gray-400">{label}</dt>
    <dd className="col-span-2 mt-0 text-sm text-gray-200 break-words">{value}</dd>
  </div>
);

const PropertiesModal: React.FC<PropertiesModalProps> = ({ isOpen, onClose, targetPath, allFiles }) => {

  const properties = useMemo(() => {
    if (!targetPath) return null;

    const isFolder = allFiles.some(f => f.name.startsWith(targetPath + '/'));

    if (isFolder) {
      const name = targetPath.split('/').pop() || targetPath;
      const containedItems = allFiles.filter(f => f.name.startsWith(targetPath + '/') && !f.name.endsWith(PLACEHOLDER_FILENAME));

      let totalSize = 0;
      let fileCount = 0;
      const directChildren = new Set<string>();

      containedItems.forEach(item => {
        totalSize += item.content?.length || 0;
        const relativePath = item.name.substring(targetPath.length + 1);
        directChildren.add(relativePath.split('/')[0]);
      });

      let folderCount = 0;
      for (const child of directChildren) {
        const childPath = `${targetPath}/${child}`;
        const isChildFolder = allFiles.some(f => f.name.startsWith(childPath + '/'));
        isChildFolder ? folderCount++ : fileCount++;
      }

      return {
        type: 'Folder',
        icon: 'folder',
        name,
        path: targetPath,
        size: totalSize,
        contents: `${fileCount} files, ${folderCount} folders`,
      };
    } else {
      const file = allFiles.find(f => f.name === targetPath);
      if (!file) return null;
      const name = targetPath.split('/').pop() || targetPath;

      return {
        type: 'File',
        icon: file.mimeType?.startsWith('image/') ? 'image' : 'file',
        name,
        path: targetPath,
        size: file.content?.length || 0,
        fileType: file.language.toUpperCase() + ' File',
        created: new Date(file.createdAt).toLocaleString(),
        modified: new Date(file.modifiedAt).toLocaleString(),
      };
    }
  }, [targetPath, allFiles]);

  if (!isOpen || !properties) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" onClick={onClose}>
      <div className="w-full max-w-md bg-gray-800 border border-gray-700 rounded-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-700 flex items-center space-x-3">
          <Icon name={properties.icon} className="w-6 h-6" />
          <h2 className="text-xl font-semibold text-white truncate">{properties.name}</h2>
        </div>
        <div className="p-6">
          <dl className="space-y-4">
            <DetailRow label="Type" value={properties.type} />
            <DetailRow label="Path" value={properties.path} />
            <DetailRow label="Size" value={formatBytes(properties.size)} />
            {'contents' in properties && <DetailRow label="Contains" value={properties.contents!} />}
            {'fileType' in properties && <DetailRow label="File Type" value={properties.fileType!} />}
            {'created' in properties && <DetailRow label="Created" value={properties.created!} />}
            {'modified' in properties && <DetailRow label="Modified" value={properties.modified!} />}
          </dl>
        </div>
        <div className="px-6 py-4 border-t border-gray-700 text-right">
          <button onClick={onClose} className="px-4 py-2 text-white bg-gray-600 rounded-md hover:bg-gray-500">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PropertiesModal;