# Shell script that generates a ZIP version of the app
# suitable for submission to the Firefox Marketplace as
# a "packaged" app.

cd www ; zip -r ../checkin.zip * -x *.DS_Store