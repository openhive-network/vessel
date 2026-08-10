import React from 'react';
import { Popup } from 'semantic-ui-react';

function NumericLabel(props) {
  // inspired by http://stackoverflow.com/a/9462382
  function nFormatter(num, minValue) {
    if (!num || !+num || typeof +num !== 'number') {
      return {
        number: num,
      };
    }
    num = +num;

    minValue = minValue || 0;

    const si = [
      { value: 1e18, symbol: 'E' },
      { value: 1e15, symbol: 'P' },
      { value: 1e12, symbol: 'T' },
      { value: 1e9, symbol: 'G' },
      { value: 1e6, symbol: 'M' },
      { value: 1e3, symbol: 'k' },
    ];
    let i;

    if (typeof num === 'number' && num >= minValue) {
      for (i = 0; i < si.length; i++) {
        if (num >= si[i].value) {
          // return (num / si[i].value).toFixed(digits).replace(rx, "$1") + si[i].symbol;
          return {
            number: num / si[i].value,
            letter: si[i].symbol,
          };
        }
      }
    }
    // return num.replace(rx, "$1");
    return {
      number: num,
    };
  }

  let css: any;
  // Hoisted (function-scoped, like the legacy `var`s): assigned in BOTH the if/else branches below and
  // read afterward, so block-scoping them would break the else path + the post-block reads.
  let locales: any;
  let number: any;
  let mystyle: any;
  let option: any;
  if (props.params) {
    ({ locales } = props.params);
    if (props.params.wholenumber === 'floor') {
      number = Math.floor(props.children);
    } else if (props.params.wholenumber === 'ceil') {
      number = Math.ceil(props.children);
    } else {
      number = props.children;
    }

    let styles = 'right';
    if (props.params.justification === 'L') {
      styles = 'left';
    } else if (props.params.justification === 'C') {
      styles = 'center';
    } else {
      styles = 'right';
    }
    mystyle = {
      textAlign: styles,
    };

    let currencyIndicator = 'USD';
    if (props.params.currencyIndicator) {
      currencyIndicator = props.params.currencyIndicator;
    }

    if (props.params.percentage) {
      option = {
        style: 'percent',
        maximumFractionDigits: props.params.precision,
        useGrouping: props.params.commafy,
      };
    } else if (props.params.currency) {
      option = {
        style: 'currency',
        currency: currencyIndicator,
        maximumFractionDigits: props.params.precision,
        useGrouping: props.params.commafy,
      };
    } else {
      option = {
        style: 'decimal',
        maximumFractionDigits: props.params.precision,
        useGrouping: props.params.commafy,
      };
    }

    css = '';
    // if(props.params.cssClass) {
    //   props.params.cssClass.map((clas) => {
    //     css += clas + ' ';
    //   });
    // }
  } else {
    number = props.children;
    locales = 'en-US';
    mystyle = {
      textAlign: 'left',
    };
    option = {};
  }

  let shortenNumber = parseFloat(number);
  let numberLetter = '';

  if (props.params && props.params.shortFormat) {
    const sn = nFormatter(number, props.params.shortFormatMinValue || 0);
    shortenNumber = sn.number;
    numberLetter = sn.letter || '';

    if (props.params.shortFormatMinValue && +number >= props.params.shortFormatMinValue) {
      option.maximumFractionDigits =
        props.params.shortFormatPrecision || props.params.precision || 0;
    }
  }
  if (!shortenNumber) return <span>0</span>;
  if (!shortenNumber.toFixed) return <span>?</span>;
  let theFormattedNumber = shortenNumber.toFixed(3);

  if (numberLetter) {
    if (props.params && props.params.percentage) {
      theFormattedNumber = theFormattedNumber.replace('%', `${numberLetter}%`);
    } else {
      theFormattedNumber += numberLetter;
    }
  }

  let title: any = false;
  if (props.params && props.params.title) {
    props.params.title === true ? (title = number) : (title = props.params.title);
  }

  // span
  if (title) {
    // with title
    return (
      <span className={css} style={mystyle} title={title}>
        {theFormattedNumber}
      </span>
    );
  }
  // without title
  number = Math.round(number * 1000000) / 1000000;
  return (
    <Popup
      hoverable
      className={css}
      style={mystyle}
      trigger={<span>{theFormattedNumber}</span>}
      content={<span>{number.toFixed(3)}</span>}
      position="right center"
    />
  );
}

export default NumericLabel;
