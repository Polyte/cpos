
  # Clinton Point of Sale System

  This is a code bundle for Clinton Point of Sale System. The original project is available at https://www.figma.com/design/iGncBFC2FolfUrzOZcjev4/Clinton-Point-of-Sale-System.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## Login

  The login form uses the deployed backend by default. To point it at another
  backend, set `VITE_API_URL` to the full `make-server-69ad2d15` endpoint before
  starting Vite. During local development, if that backend is unreachable, the
  seeded demo accounts can still open the UI with password `password123`.

  The demo retail catalog is South African-market themed, with Makro-style
  pantry, bulk household, snack and beverage products. Prices are demo values
  inspired by public Makro listings and are not live stock or promotions.

  The Restaurant tenant includes a compact Mugg & Bean-inspired coffee,
  breakfast, lunch and bakery menu for POS testing. Prices are demo values.

  Stock Controller barcode lookup uses BarcodeNest through the server proxy.
  Set `BARCODENEST_API_KEY` in the Edge Function environment; do not put this
  secret in frontend code or a `VITE_` variable.
