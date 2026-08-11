import React from 'react';

const AccountName: React.FC<any> = ({ name }) => {
  const handleLink = () => {
    window.electronAPI?.openExternal(`https://hive.blog/@${encodeURIComponent(name)}`);
  };

  return <a onClick={handleLink}>{name}</a>;
};

export default AccountName;
