NotoSansJP-ExtraBold.ttf: Noto Sans JP（可変フォント）を fontTools で wght=800 に固定したもの。OFL-NotoSansJP.txt
Oswald-Bold.ttf: Oswald（google/fonts の可変フォント）を wght=700 に固定したもの。OFL-Oswald.txt
作り直し: python -m fontTools.varLib.instancer <可変フォント> wght=<太さ> -o <出力>
